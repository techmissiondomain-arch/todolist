import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart' show SharedPreferences;

import 'core/constants/app_constants.dart';
import 'core/theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/task_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/onboarding/onboarding_screen.dart';
import 'services/notification_service.dart';

/// Root widget. Decides which screen to show based on:
///   • whether onboarding has been seen
///   • whether the user is logged in
class GeoTaskApp extends StatelessWidget {
  const GeoTaskApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GeoTask AI',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      home: const _Gate(),
    );
  }
}

class _Gate extends StatefulWidget {
  const _Gate();

  @override
  State<_Gate> createState() => _GateState();
}

class _GateState extends State<_Gate> {
  bool? _onboarded;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() => _onboarded = prefs.getBool(AppConstants.prefsOnboarded) ?? false);
  }

  @override
  Widget build(BuildContext context) {
    if (_onboarded == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_onboarded == false) {
      return OnboardingScreen(onDone: () => setState(() => _onboarded = true));
    }

    // Logged-in? -> Home, else -> Login.
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        if (auth.isLoggedIn) {
          // Load data + wire device callbacks once we have a session.
          final tasks = context.read<TaskProvider>();
          WidgetsBinding.instance.addPostFrameCallback((_) {
            tasks.bindDeviceCallbacks();
            tasks.load();
            // Prime notification permission (Android 13+ / iOS ask at runtime).
            NotificationService.instance.requestPermission();
          });
          return const HomeScreen();
        }
        return const LoginScreen();
      },
    );
  }
}
