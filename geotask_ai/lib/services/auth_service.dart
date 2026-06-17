import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/errors/failures.dart';
import '../core/utils/logger.dart';
import 'supabase_service.dart';

/// Wraps Supabase auth with friendly errors. Business logic only — no UI.
class AuthService {
  final _sb = SupabaseService.instance;

  /// Stream of auth changes so the app can react to login/logout.
  Stream<AuthState> get authChanges => _sb.auth.onAuthStateChange;

  User? get currentUser => _sb.currentUser;
  bool get isLoggedIn => currentUser != null;

  Future<void> signUp({
    required String email,
    required String password,
    String? fullName,
  }) async {
    try {
      await _sb.auth.signUp(
        email: email.trim(),
        password: password,
        data: {'full_name': fullName ?? ''},
      );
    } on AuthException catch (e) {
      Log.e('signUp failed', e);
      throw AuthFailure(e.message, e);
    } catch (e) {
      throw const AuthFailure('Could not create the account. Try again.');
    }
  }

  Future<void> signIn({
    required String email,
    required String password,
  }) async {
    try {
      await _sb.auth.signInWithPassword(
        email: email.trim(),
        password: password,
      );
    } on AuthException catch (e) {
      Log.e('signIn failed', e);
      throw AuthFailure(e.message, e);
    } catch (e) {
      throw const AuthFailure('Could not sign in. Check your details.');
    }
  }

  Future<void> sendPasswordReset(String email) async {
    try {
      await _sb.auth.resetPasswordForEmail(email.trim());
    } on AuthException catch (e) {
      throw AuthFailure(e.message, e);
    }
  }

  Future<void> signOut() async {
    await _sb.auth.signOut();
  }
}
