/// Mirrors the `saved_locations` table (Home, Work, Carrefour, ...).
class SavedLocation {
  final String id;
  final String userId;
  final String name;
  final String? address;
  final double latitude;
  final double longitude;
  final int radiusMeters;
  final String icon;
  final DateTime createdAt;
  final DateTime updatedAt;

  const SavedLocation({
    required this.id,
    required this.userId,
    required this.name,
    this.address,
    required this.latitude,
    required this.longitude,
    this.radiusMeters = 200,
    this.icon = 'place',
    required this.createdAt,
    required this.updatedAt,
  });

  factory SavedLocation.fromMap(Map<String, dynamic> m) => SavedLocation(
        id: m['id'] as String,
        userId: m['user_id'] as String,
        name: m['name'] as String? ?? '',
        address: m['address'] as String?,
        latitude: (m['latitude'] as num).toDouble(),
        longitude: (m['longitude'] as num).toDouble(),
        radiusMeters: (m['radius_meters'] as num?)?.toInt() ?? 200,
        icon: m['icon'] as String? ?? 'place',
        createdAt:
            DateTime.tryParse('${m['created_at']}')?.toLocal() ?? DateTime.now(),
        updatedAt:
            DateTime.tryParse('${m['updated_at']}')?.toLocal() ?? DateTime.now(),
      );

  Map<String, dynamic> toInsertMap() => {
        'user_id': userId,
        'name': name,
        'address': address,
        'latitude': latitude,
        'longitude': longitude,
        'radius_meters': radiusMeters,
        'icon': icon,
      };

  SavedLocation copyWith({
    String? name,
    String? address,
    double? latitude,
    double? longitude,
    int? radiusMeters,
    String? icon,
  }) =>
      SavedLocation(
        id: id,
        userId: userId,
        name: name ?? this.name,
        address: address ?? this.address,
        latitude: latitude ?? this.latitude,
        longitude: longitude ?? this.longitude,
        radiusMeters: radiusMeters ?? this.radiusMeters,
        icon: icon ?? this.icon,
        createdAt: createdAt,
        updatedAt: updatedAt,
      );
}
