import { ConflictException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../../common/database/database.service';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private scheduler?: NodeJS.Timeout;
  constructor(private readonly db:DatabaseService, private readonly config:ConfigService){}

  onModuleInit(){
    this.scheduler=setInterval(()=>{ void this.dispatchDueCampaigns(); },60_000);
    this.scheduler.unref();
    void this.dispatchDueCampaigns();
  }
  onModuleDestroy(){ if(this.scheduler) clearInterval(this.scheduler); }
  private async dispatchDueCampaigns(){
    try{
      const due=await this.db.query<{id:string}>(`SELECT id FROM push_campaigns WHERE status='scheduled' AND scheduled_at<=now() ORDER BY scheduled_at LIMIT 10`);
      for(const row of due){ try{ await this.dispatchCampaign(row.id); }catch{} }
    }catch{}
  }

  private key():Buffer {
    const raw=this.config.get<string>('PUSH_TOKEN_ENCRYPTION_KEY');
    if(!raw) throw new ServiceUnavailableException('Push token encryption is not configured');
    const key=Buffer.from(raw,'base64');
    if(key.length!==32) throw new ServiceUnavailableException('Push token encryption key must be 32 bytes base64');
    return key;
  }
  private hash(token:string){return createHash('sha256').update(token).digest('hex');}
  private encrypt(token:string){
    const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',this.key(),iv);
    const ciphertext=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
    return {ciphertext:ciphertext.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64')};
  }
  private decrypt(row:any){
    const decipher=createDecipheriv('aes-256-gcm',this.key(),Buffer.from(row.token_iv,'base64'));
    decipher.setAuthTag(Buffer.from(row.token_tag,'base64'));
    return Buffer.concat([decipher.update(Buffer.from(row.token_ciphertext,'base64')),decipher.final()]).toString('utf8');
  }

  async registerDevice(userId:string,dto:RegisterPushDeviceDto){
    const tokenHash=this.hash(dto.token); const enc=this.encrypt(dto.token);
    const row=await this.db.one<any>(
      `INSERT INTO push_devices (user_id,provider,token_hash,token_ciphertext,token_iv,token_tag,platform,app_version,enabled,last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,now())
       ON CONFLICT (token_hash) DO UPDATE SET user_id=EXCLUDED.user_id,provider=EXCLUDED.provider,
         token_ciphertext=EXCLUDED.token_ciphertext,token_iv=EXCLUDED.token_iv,token_tag=EXCLUDED.token_tag,
         platform=EXCLUDED.platform,app_version=EXCLUDED.app_version,enabled=true,last_seen_at=now()
       RETURNING id,provider,platform,app_version,last_seen_at`,
      [userId,dto.provider,tokenHash,enc.ciphertext,enc.iv,enc.tag,dto.platform,dto.appVersion??null]
    );
    return row;
  }
  async unregisterDevice(userId:string,token:string){
    await this.db.query(`UPDATE push_devices SET enabled=false,last_seen_at=now() WHERE user_id=$1 AND token_hash=$2`,[userId,this.hash(token)]);
    return {ok:true};
  }
  async list(userId:string,limit=50){
    const safe=Math.max(1,Math.min(100,Math.trunc(limit)));
    const [items,unread]=await Promise.all([
      this.db.query<any>(`SELECT id,title,body,payload,read_at,created_at FROM in_app_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,[userId,safe]),
      this.db.one<any>(`SELECT count(*)::int AS count FROM in_app_notifications WHERE user_id=$1 AND read_at IS NULL`,[userId])
    ]);
    return {items,unread:Number(unread?.count??0)};
  }
  async markRead(userId:string,id:string){
    await this.db.query(`UPDATE in_app_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2`,[id,userId]);
    return {ok:true};
  }

  async dispatchCampaign(campaignId:string){
    const existing=await this.db.one<any>(`SELECT * FROM push_campaigns WHERE id=$1`,[campaignId]);
    if(!existing) throw new NotFoundException('Campaign not found');
    if(existing.status==='sent') return {campaignId,duplicate:true,inAppCreated:0,push:{sent:0,failed:0,skipped:0,providerConfigured:!!this.config.get<string>('PUSH_PROVIDER_URL')}};
    if(existing.status==='sending') throw new ConflictException('Campaign is already being dispatched');
    const campaign=await this.db.one<any>(
      `UPDATE push_campaigns SET status='sending',updated_at=now() WHERE id=$1 AND status IN ('draft','scheduled','failed') RETURNING *`,[campaignId]
    );
    if(!campaign) throw new ConflictException('Campaign cannot be dispatched from its current state');
    const users=await this.db.query<{id:string}>(`SELECT id FROM users WHERE status='active' ORDER BY id`);
    let inAppCreated=0;
    for(const u of users){
      const row=await this.db.one<{id:string}>(
        `INSERT INTO in_app_notifications (user_id,title,body,payload,campaign_id) VALUES ($1,$2,$3,$4::jsonb,$5)
         ON CONFLICT (campaign_id,user_id) WHERE campaign_id IS NOT NULL DO NOTHING RETURNING id`,
        [u.id,campaign.title,campaign.body,JSON.stringify(campaign.payload??{}),campaignId]
      );
      if(row) inAppCreated++;
    }

    const devices=await this.db.query<any>(
      `SELECT d.*,u.status FROM push_devices d JOIN users u ON u.id=d.user_id WHERE d.enabled=true AND u.status='active' ORDER BY d.id`
    );
    const providerUrl=this.config.get<string>('PUSH_PROVIDER_URL');
    const providerToken=this.config.get<string>('PUSH_PROVIDER_BEARER_TOKEN');
    let sent=0,failed=0,skipped=0,duplicates=0;
    for(const d of devices){
      const prior=await this.db.one<any>(`SELECT status FROM push_deliveries WHERE campaign_id=$1 AND device_id=$2`,[campaignId,d.id]);
      if(prior?.status==='sent'){ duplicates++; continue; }
      if(!providerUrl){
        skipped++;
        if(prior) await this.db.query(`UPDATE push_deliveries SET status='skipped',error='provider_not_configured',updated_at=now() WHERE campaign_id=$1 AND device_id=$2`,[campaignId,d.id]);
        else await this.db.query(`INSERT INTO push_deliveries (campaign_id,user_id,device_id,status,error) VALUES ($1,$2,$3,'skipped','provider_not_configured')`,[campaignId,d.user_id,d.id]);
        continue;
      }
      try{
        const target=new URL(providerUrl);
        if(target.protocol!=='https:' && !['localhost','127.0.0.1'].includes(target.hostname)) throw new Error('push_provider_url_must_use_https');
        const token=this.decrypt(d);
        const response=await fetch(target,{method:'POST',headers:{'content-type':'application/json',...(providerToken?{authorization:`Bearer ${providerToken}`}:{})},body:JSON.stringify({provider:d.provider,token,title:campaign.title,body:campaign.body,payload:campaign.payload??{}})});
        const text=await response.text();
        if(!response.ok) throw new Error(`provider_${response.status}:${text.slice(0,200)}`);
        let providerMessageId:string|null=null; try{providerMessageId=JSON.parse(text)?.messageId??null;}catch{}
        sent++;
        if(prior) await this.db.query(`UPDATE push_deliveries SET status='sent',provider_message_id=$3,error=NULL,updated_at=now() WHERE campaign_id=$1 AND device_id=$2`,[campaignId,d.id,providerMessageId]);
        else await this.db.query(`INSERT INTO push_deliveries (campaign_id,user_id,device_id,status,provider_message_id) VALUES ($1,$2,$3,'sent',$4)`,[campaignId,d.user_id,d.id,providerMessageId]);
      }catch(e){
        failed++;
        if(prior) await this.db.query(`UPDATE push_deliveries SET status='failed',error=$3,updated_at=now() WHERE campaign_id=$1 AND device_id=$2`,[campaignId,d.id,String(e).slice(0,500)]);
        else await this.db.query(`INSERT INTO push_deliveries (campaign_id,user_id,device_id,status,error) VALUES ($1,$2,$3,'failed',$4)`,[campaignId,d.user_id,d.id,String(e).slice(0,500)]);
      }
    }
    await this.db.query(`UPDATE push_campaigns SET status=$2,sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END,updated_at=now() WHERE id=$1`,[campaignId,failed>0&&sent===0&&devices.length>0?'failed':'sent']);
    return {campaignId,inAppCreated,push:{sent,failed,skipped,duplicates,providerConfigured:!!providerUrl}};
  }
}
