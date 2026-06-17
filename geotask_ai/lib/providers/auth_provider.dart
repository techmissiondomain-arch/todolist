import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/auth_service.dart';

/// Exposes auth state to the widget tree. Screens listen to this to decide
/// whether to show the login flow or the home screen.
class AuthProvider extends ChangeNotifier {
  final AuthService _auth = AuthService();

  AuthProvider() {
    // React to Supabase login/logout events.
    _auth.authChanges.listen((_) => notifyListeners());
  }

  User? get user => _auth.currentUser;
  bool get isLoggedIn => _auth.isLoggedIn;

  bool _busy = false;
  bool get busy => _busy;

  String? _error;
  String? get error => _error;

  Future<bool> signIn(String email, String password) =>
      _run(() => _auth.signIn(email: email, password: password));

  Future<bool> signUp(String email, String password, String name) =>
      _run(() => _auth.signUp(email: email, password: password, fullName: name));

  Future<bool> resetPassword(String email) =>
      _run(() => _auth.sendPasswordReset(email));

  Future<void> signOut() => _auth.signOut();

  Future<bool> _run(Future<void> Function() action) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      await action();
      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }
}
