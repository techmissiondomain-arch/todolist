import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/enums.dart';
import '../../models/parsed_task.dart';
import '../../models/saved_location.dart';
import '../../models/task.dart';
import '../../providers/location_provider.dart';
import '../../providers/task_provider.dart';
import '../../services/location_service.dart';
import '../../services/notification_service.dart';
import '../../services/supabase_service.dart';
import '../location_picker/location_picker_screen.dart';

/// Shows the AI's interpretation and lets the user verify/adjust before saving.
/// Crucially, this is where the user CONFIRMS the real location coordinates.
class TaskConfirmationScreen extends StatefulWidget {
  final ParsedTask parsed;
  final String original;
  const TaskConfirmationScreen(
      {super.key, required this.parsed, required this.original});

  @override
  State<TaskConfirmationScreen> createState() => _TaskConfirmationScreenState();
}

class _TaskConfirmationScreenState extends State<TaskConfirmationScreen> {
  late TextEditingController _title;
  late TriggerType _trigger;
  late TaskPriority _priority;
  late int _radius;
  DateTime? _dueDate;

  /// The resolved place (coordinates). Null until the user confirms one.
  SavedLocation? _place;
  bool _resolving = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(text: widget.parsed.title);
    _trigger = widget.parsed.triggerType;
    _priority = widget.parsed.priority;
    _radius = widget.parsed.radiusMeters;
    _dueDate = widget.parsed.dueDate;
    _tryResolve();
  }

  /// Try to match the AI's location name to a place the user already saved.
  Future<void> _tryResolve() async {
    if (!_trigger.isLocationBased) {
      setState(() => _resolving = false);
      return;
    }
    final loc = context.read<LocationProvider>();
    if (loc.places.isEmpty) await loc.load();
    final match = await loc.resolveByName(widget.parsed.locationName);
    if (mounted) {
      setState(() {
        _place = match;
        _resolving = false;
      });
    }
  }

  Future<void> _pickLocation() async {
    final result = await Navigator.of(context).push<SavedLocation>(
      MaterialPageRoute(
        builder: (_) => LocationPickerScreen(
          initialName: widget.parsed.locationName,
          initialRadius: _radius,
        ),
      ),
    );
    if (result != null) setState(() => _place = result);
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_dueDate ?? now),
    );
    if (!mounted) return;
    setState(() => _dueDate = DateTime(
        date.year, date.month, date.day, time?.hour ?? 9, time?.minute ?? 0));
  }

  Future<void> _save() async {
    // For location reminders we need: a confirmed place + background permission.
    if (_trigger.isLocationBased) {
      if (_place == null) {
        _snack('Pick the exact location first.');
        return;
      }
      final granted = await _ensureBackgroundLocation();
      if (!granted) return;
    }

    setState(() => _saving = true);

    final uid = SupabaseService.instance.userId!;
    final now = DateTime.now();
    final draft = Task(
      id: 'tmp', // replaced by DB
      userId: uid,
      title: _title.text.trim(),
      description: widget.parsed.description,
      priority: _priority,
      triggerType: _trigger,
      savedLocationId: _place?.id,
      locationName: _place?.name ?? widget.parsed.locationName,
      latitude: _place?.latitude,
      longitude: _place?.longitude,
      radiusMeters: _radius,
      dueDate: _dueDate,
      needsLocationConfirmation: false,
      createdAt: now,
      updatedAt: now,
    );

    final saved = await context.read<TaskProvider>().add(draft);
    if (!mounted) return;
    setState(() => _saving = false);

    if (saved != null) {
      Navigator.of(context).popUntil((r) => r.isFirst);
      _snack('Reminder saved ✓');
    } else {
      _snack('Could not save. Try again.');
    }
  }

  /// Ask for background ("always") location, explaining clearly why.
  Future<bool> _ensureBackgroundLocation() async {
    final loc = LocationService.instance;
    await NotificationService.instance.requestPermission();

    if (await loc.hasAlways()) return true;

    final proceed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Allow location in the background'),
            content: const Text(
                'To remind you at the right place, GeoTask needs to check your '
                'location even when the app is closed or in your pocket.\n\n'
                'We only use it to fire your reminders. We never sell your '
                'location, and you can turn this off anytime in Settings.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Not now')),
              FilledButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Continue')),
            ],
          ),
        ) ??
        false;
    if (!proceed) return false;

    final granted = await loc.requestAlways();
    if (!granted && mounted) {
      _snack('Background location is needed for place reminders.');
    }
    return granted;
  }

  void _snack(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Confirm reminder')),
      body: _resolving
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _aiNote(),
                const SizedBox(height: 16),
                TextField(
                  controller: _title,
                  decoration: const InputDecoration(labelText: 'Task'),
                ),
                const SizedBox(height: 16),
                _triggerSelector(),
                if (_trigger.isLocationBased) ...[
                  const SizedBox(height: 16),
                  _locationCard(),
                  const SizedBox(height: 16),
                  _radiusSlider(),
                ],
                const SizedBox(height: 16),
                _prioritySelector(),
                const SizedBox(height: 16),
                _dueDateTile(),
                const SizedBox(height: 28),
                FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.check),
                  label: const Text('Save reminder'),
                ),
              ],
            ),
    );
  }

  Widget _aiNote() => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              const Icon(Icons.auto_awesome, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Text('AI understood: “${widget.original}”',
                    style: Theme.of(context).textTheme.bodySmall),
              ),
            ],
          ),
        ),
      );

  Widget _triggerSelector() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Trigger', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: TriggerType.values.map((t) {
              return ChoiceChip(
                label: Text(t.label),
                selected: _trigger == t,
                onSelected: (_) => setState(() => _trigger = t),
              );
            }).toList(),
          ),
        ],
      );

  Widget _locationCard() => Card(
        child: ListTile(
          leading: Icon(_place == null ? Icons.add_location_alt : Icons.place,
              color: Theme.of(context).colorScheme.primary),
          title: Text(_place?.name ??
              widget.parsed.locationName ??
              'Choose a location'),
          subtitle: Text(_place == null
              ? 'Tap to confirm the exact place on the map'
              : (_place!.address ?? 'Confirmed location')),
          trailing: const Icon(Icons.chevron_right),
          onTap: _pickLocation,
        ),
      );

  Widget _radiusSlider() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Trigger radius: $_radius m',
              style: Theme.of(context).textTheme.titleSmall),
          Slider(
            value: _radius.toDouble(),
            min: 50,
            max: 1000,
            divisions: 19,
            label: '$_radius m',
            onChanged: (v) => setState(() => _radius = v.round()),
          ),
        ],
      );

  Widget _prioritySelector() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Priority', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: TaskPriority.values.map((p) {
              return ChoiceChip(
                label: Text(p.name),
                selected: _priority == p,
                onSelected: (_) => setState(() => _priority = p),
              );
            }).toList(),
          ),
        ],
      );

  Widget _dueDateTile() => Card(
        child: ListTile(
          leading: const Icon(Icons.schedule),
          title: Text(_dueDate == null
              ? 'Add a time (optional)'
              : DateFormat('EEE, MMM d · h:mm a').format(_dueDate!)),
          trailing: _dueDate == null
              ? const Icon(Icons.chevron_right)
              : IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () => setState(() => _dueDate = null),
                ),
          onTap: _pickDate,
        ),
      );
}
