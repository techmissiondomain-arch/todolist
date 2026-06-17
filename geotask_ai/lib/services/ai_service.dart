import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/app_config.dart';
import '../core/errors/failures.dart';
import '../core/utils/logger.dart';
import '../models/parsed_task.dart';
import 'supabase_service.dart';

/// Talks to our Supabase Edge Function ("parse-task"), which in turn calls
/// Claude. The Claude key NEVER lives in the app — only on the server.
///
/// Claude's ONLY job: understand the sentence and return structured JSON.
/// The phone does geofencing/notifications (see LocationService / etc).
class AiService {
  final _http = http.Client();

  Future<ParsedTask> parse(String sentence) async {
    final token = SupabaseService.instance.accessToken;
    if (token == null) {
      throw const AiFailure('You must be signed in to use AI.');
    }

    try {
      final res = await _http
          .post(
            Uri.parse(AppConfig.aiParseUrl),
            headers: {
              'Content-Type': 'application/json',
              // The edge function verifies this token.
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'text': sentence,
              'now': DateTime.now().toIso8601String(),
              'timezone': DateTime.now().timeZoneName,
            }),
          )
          .timeout(const Duration(seconds: 25));

      if (res.statusCode != 200) {
        Log.e('AI parse HTTP ${res.statusCode}: ${res.body}');
        throw AiFailure('AI service error (${res.statusCode}).');
      }

      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final task = body['task'];
      if (task is! Map<String, dynamic>) {
        throw const AiFailure('AI returned an unexpected response.');
      }
      return ParsedTask.fromJson(task);
    } on AiFailure {
      rethrow;
    } catch (e) {
      Log.e('AI parse failed', e);
      throw const AiFailure('Could not reach the AI service. Try again.');
    }
  }
}
