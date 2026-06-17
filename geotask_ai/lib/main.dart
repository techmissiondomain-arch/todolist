import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'core/utils/logger.dart';
import 'providers/auth_provider.dart';
import 'providers/location_provider.dart';
import 'providers/task_provider.dart';
import 'services/notification_service.dart';
import 'services/supabase_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1) Load config from .env (Supabase keys, maps key, AI url).
  await dotenv.load(fileName: '.env');

  // 2) Start Supabase (auth + database).
  await SupabaseService.init();

  // 3) Set up local notifications (channel + tap handlers).
  await NotificationService.instance.init();

  Log.d('App initialized.');

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => TaskProvider()),
        ChangeNotifierProvider(create: (_) => LocationProvider()),
      ],
      child: const GeoTaskApp(),
    ),
  );
}
