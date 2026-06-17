/// A simple typed error used across services so the UI can show a friendly
/// message instead of a raw exception. Beginner-friendly error handling.
class AppFailure implements Exception {
  final String message;
  final Object? cause;
  const AppFailure(this.message, [this.cause]);

  @override
  String toString() => message;
}

class AuthFailure extends AppFailure {
  const AuthFailure(super.message, [super.cause]);
}

class NetworkFailure extends AppFailure {
  const NetworkFailure(super.message, [super.cause]);
}

class AiFailure extends AppFailure {
  const AiFailure(super.message, [super.cause]);
}

class LocationFailure extends AppFailure {
  const LocationFailure(super.message, [super.cause]);
}
