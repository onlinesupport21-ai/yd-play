import 'package:flutter/material.dart';

class CoinBadge extends StatelessWidget {
  const CoinBadge({super.key, required this.balance, this.compact = false});
  final int balance;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: compact ? 10 : 14, vertical: compact ? 7 : 10),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.monetization_on_rounded, size: compact ? 18 : 22),
          const SizedBox(width: 6),
          Text('$balance', style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}
