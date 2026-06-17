import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/saved_location.dart';
import '../../providers/location_provider.dart';
import '../location_picker/location_picker_screen.dart';

/// Manage saved places (Home, Work, Supermarket, Pharmacy...).
/// Privacy: the user can delete any place at any time.
class SavedLocationsScreen extends StatefulWidget {
  const SavedLocationsScreen({super.key});

  @override
  State<SavedLocationsScreen> createState() => _SavedLocationsScreenState();
}

class _SavedLocationsScreenState extends State<SavedLocationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
        (_) => context.read<LocationProvider>().load());
  }

  Future<void> _addNew() async {
    await Navigator.of(context).push<SavedLocation>(
      MaterialPageRoute(builder: (_) => const LocationPickerScreen()),
    );
  }

  Future<void> _confirmDelete(SavedLocation loc) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Delete "${loc.name}"?'),
        content: const Text(
            'This removes the saved place. Reminders using it will keep their '
            'coordinates but you won’t be able to reuse the place by name.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (ok == true && mounted) {
      await context.read<LocationProvider>().remove(loc.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<LocationProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Saved places')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addNew,
        icon: const Icon(Icons.add_location_alt),
        label: const Text('Add place'),
      ),
      body: provider.loading
          ? const Center(child: CircularProgressIndicator())
          : provider.places.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(40),
                    child: Text(
                      'No saved places yet.\nAdd Home, Work, or your favourite '
                      'supermarket to reuse them in reminders.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 96),
                  children: provider.places
                      .map((loc) => Card(
                            child: ListTile(
                              leading: const Icon(Icons.place),
                              title: Text(loc.name),
                              subtitle: Text(loc.address ??
                                  '${loc.latitude.toStringAsFixed(4)}, '
                                      '${loc.longitude.toStringAsFixed(4)} · '
                                      '${loc.radiusMeters}m'),
                              trailing: IconButton(
                                icon: const Icon(Icons.delete_outline),
                                onPressed: () => _confirmDelete(loc),
                              ),
                            ),
                          ))
                      .toList(),
                ),
    );
  }
}
