import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';

/// Thin wrapper around the Supabase client so the rest of the app imports
/// ONE place instead of `Supabase.instance.client` everywhere.
class SupabaseService {
  SupabaseService._();
  static final SupabaseService instance = SupabaseService._();

  /// Call once in main() before runApp().
  static Future<void> init() async {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      anonKey: AppConfig.supabaseAnonKey,
    );
  }

  SupabaseClient get client => Supabase.instance.client;

  GoTrueClient get auth => client.auth;

  User? get currentUser => client.auth.currentUser;
  String? get userId => currentUser?.id;

  /// The current access token — needed to authorize the AI edge function.
  String? get accessToken => client.auth.currentSession?.accessToken;
}
