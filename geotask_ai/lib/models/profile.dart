/// Mirrors the `profiles` table — one row per user, plus privacy toggles.
class Profile {
  final String id;
  final String? email;
  final String? fullName;
  final String? avatarUrl;
  final bool locationEnabled;
  final bool backgroundLocationOk;
  final bool notificationsEnabled;

  const Profile({
    required this.id,
    this.email,
    this.fullName,
    this.avatarUrl,
    this.locationEnabled = true,
    this.backgroundLocationOk = false,
    this.notificationsEnabled = true,
  });

  factory Profile.fromMap(Map<String, dynamic> m) => Profile(
        id: m['id'] as String,
        email: m['email'] as String?,
        fullName: m['full_name'] as String?,
        avatarUrl: m['avatar_url'] as String?,
        locationEnabled: m['location_enabled'] as bool? ?? true,
        backgroundLocationOk: m['background_location_ok'] as bool? ?? false,
        notificationsEnabled: m['notifications_enabled'] as bool? ?? true,
      );

  Map<String, dynamic> toUpdateMap() => {
        'full_name': fullName,
        'avatar_url': avatarUrl,
        'location_enabled': locationEnabled,
        'background_location_ok': backgroundLocationOk,
        'notifications_enabled': notificationsEnabled,
      };

  Profile copyWith({
    String? fullName,
    String? avatarUrl,
    bool? locationEnabled,
    bool? backgroundLocationOk,
    bool? notificationsEnabled,
  }) =>
      Profile(
        id: id,
        email: email,
        fullName: fullName ?? this.fullName,
        avatarUrl: avatarUrl ?? this.avatarUrl,
        locationEnabled: locationEnabled ?? this.locationEnabled,
        backgroundLocationOk: backgroundLocationOk ?? this.backgroundLocationOk,
        notificationsEnabled:
            notificationsEnabled ?? this.notificationsEnabled,
      );
}
