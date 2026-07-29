import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/connectivity/connectivity_provider.dart';

/// Top banner when the device reports no network. Non-blocking for cached UI.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final connectivity = context.watch<ConnectivityProvider>();
    if (connectivity.isOnline) return const SizedBox.shrink();

    return Material(
      color: const Color(0xFF78350F),
      elevation: 4,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 2),
                child: Icon(Icons.wifi_off_rounded, color: Color(0xFFFDE68A), size: 20),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'No internet connection',
                      style: TextStyle(
                        color: Color(0xFFFFFBEB),
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Please check your network and try again. Some actions won\'t work until you\'re back online.',
                      style: TextStyle(
                        color: Color(0xFFFDE68A),
                        fontSize: 12,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: connectivity.isChecking
                    ? null
                    : () async {
                        final ok = await context.read<ConnectivityProvider>().refresh();
                        if (ok && context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('You\'re back online'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        }
                      },
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF78350F),
                  backgroundColor: const Color(0xFFFDE68A),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: connectivity.isChecking
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF78350F)),
                      )
                    : const Text('Retry', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Wraps the navigator so the offline bar sits above every route.
class OfflineAwareAppShell extends StatelessWidget {
  final Widget? child;

  const OfflineAwareAppShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const OfflineBanner(),
        Expanded(child: child ?? const SizedBox.shrink()),
      ],
    );
  }
}
