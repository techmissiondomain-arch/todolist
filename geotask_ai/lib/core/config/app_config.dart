import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Central place to read configuration that comes from the `.env` file.
///
/// We load `.env` once in `main()` (see main.dart) and then read values
/// through these typed getters so the rest of the app never touches
/// `dotenv` directly.
class AppConfig {
  AppConfig._();

  static String get supabaseUrl => _require('SUPABASE_URL');
  static String get supabaseAnonKey => _require('SUPABASE_ANON_KEY');
  static String get googleMapsApiKey => _require('GOOGLE_MAPS_API_KEY');

  /// URL of the deployed Supabase Edge Function that talks to Claude.
  static String get aiParseUrl => _require('AI_PARSE_URL');

  static String _require(String key) {
    final value = dotenv.maybeGet(key);
    if (value == null || value.isEmpty) {
      throw StateError(
        'Missing "$key" in .env — copy .env.example to .env and fill it in.',
      );
    }
    return value;
  }
}
