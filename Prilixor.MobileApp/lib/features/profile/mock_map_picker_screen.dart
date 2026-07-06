import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:dio/dio.dart';

class MockMapPickerScreen extends StatefulWidget {
  const MockMapPickerScreen({super.key});

  @override
  State<MockMapPickerScreen> createState() => _MockMapPickerScreenState();
}

class _MockMapPickerScreenState extends State<MockMapPickerScreen> {
  LatLng _center = const LatLng(23.0225, 72.5714);
  final MapController _mapController = MapController();
  bool _isSearching = false;

  Future<void> _searchLocation(String query) async {
    if (query.trim().isEmpty) return;
    setState(() => _isSearching = true);
    try {
      // Upgraded to Photon API (same as Web App) for fuzzy searching and better results
      final response = await Dio().get(
        'https://photon.komoot.io/api/',
        queryParameters: {
          'q': query,
          'lat': _center.latitude,
          'lon': _center.longitude,
          'limit': 1,
          'lang': 'en'
        },
      );
      if (response.statusCode == 200 && response.data != null) {
        final features = response.data['features'] as List;
        if (features.isNotEmpty) {
          final coords = features[0]['geometry']['coordinates'];
          // GeoJSON returns [longitude, latitude]
          final lon = (coords[0] as num).toDouble();
          final lat = (coords[1] as num).toDouble();
          
          final pos = LatLng(lat, lon);
          _mapController.move(pos, 15.0);
          setState(() => _center = pos);
        } else {
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location not found')));
        }
      } else {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location not found')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error searching location')));
    } finally {
      if (mounted) setState(() => _isSearching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        title: const Text('Pick Location', style: TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 13.0,
              onPositionChanged: (MapCamera camera, bool hasGesture) {
                setState(() {
                  _center = camera.center;
                });
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.prilixor.vendorportal',
              ),
            ],
          ),
          
          const Center(
            child: Padding(
              padding: EdgeInsets.only(bottom: 40.0),
              child: Icon(Icons.location_on, size: 50, color: Color(0xFF6C63FF)),
            ),
          ),
          
          Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(12),
                boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 10, offset: Offset(0, 4))],
              ),
              child: TextField(
                style: const TextStyle(color: Colors.white),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: 'Search city, area, or zip...',
                  hintStyle: const TextStyle(color: Colors.white54),
                  prefixIcon: const Icon(Icons.search, color: Color(0xFF6C63FF)),
                  suffixIcon: _isSearching ? const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6C63FF))) : null,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
                onSubmitted: _searchLocation,
              ),
            ),
          ),

          Positioned(
            bottom: 32,
            left: 24,
            right: 24,
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context, {
                    'latitude': _center.latitude,
                    'longitude': _center.longitude,
                  });
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6C63FF),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Confirm Location', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
