# Flutter keeps framework entrypoints through its Gradle tooling.
# Keep annotations/signatures used by plugins and reflection-based Android APIs.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-dontwarn javax.annotation.**
