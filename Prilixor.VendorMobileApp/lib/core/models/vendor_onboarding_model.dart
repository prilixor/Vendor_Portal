import '../utils/admin_comment_util.dart';

class VendorDocument {
  final String id;
  final String documentType;
  final String fileUrl;
  final String verificationStatus;
  final String? rejectionReason;

  const VendorDocument({
    required this.id,
    required this.documentType,
    required this.fileUrl,
    required this.verificationStatus,
    this.rejectionReason,
  });

  factory VendorDocument.fromJson(Map<String, dynamic> json) {
    return VendorDocument(
      id: json['id']?.toString() ?? '',
      documentType: json['documentType']?.toString() ?? '',
      fileUrl: json['fileUrl']?.toString() ?? '',
      verificationStatus: json['verificationStatus']?.toString() ?? 'pending',
      rejectionReason: json['rejectionReason']?.toString(),
    );
  }

  String get displayFileName {
    if (fileUrl.isEmpty) return documentType;
    final parts = fileUrl.split('/').where((s) => s.isNotEmpty).toList();
    if (parts.isEmpty) return documentType;
    return Uri.decodeComponent(parts.last.split('?').first);
  }

  /// User-facing subtitle — hides internal server filenames (timestamp + GUID).
  String get displayFileLabel {
    final name = displayFileName;
    if (_isServerGeneratedFileName(name)) {
      if (isPdfFile) return 'PDF uploaded';
      if (isImageFile) return 'Image uploaded';
      return 'File uploaded';
    }
    if (name.length > 42) {
      if (isPdfFile) return 'PDF uploaded';
      if (isImageFile) return 'Image uploaded';
      return 'File uploaded';
    }
    return name;
  }

  String? get displayRejectionReason => sanitizeAdminComment(rejectionReason);

  bool get isRejected => verificationStatus.trim().toLowerCase() == 'rejected';

  bool _isServerGeneratedFileName(String name) {
    final lower = name.toLowerCase();
    return RegExp(r'^\d{14,}_[a-f0-9-]{20,}', caseSensitive: false).hasMatch(lower);
  }

  bool get isImageFile {
    final name = displayFileName.toLowerCase();
    return name.endsWith('.png') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.webp') ||
        name.endsWith('.gif');
  }

  bool get isPdfFile {
    final name = displayFileName.toLowerCase();
    if (name.endsWith('.pdf')) return true;
    // Legacy uploads saved without an extension but served as PDF.
    return fileUrl.toLowerCase().contains('contenttype=application/pdf') ||
        fileUrl.toLowerCase().contains('content-type=application/pdf');
  }
}

class VendorBankAccount {
  final String id;
  final String accountHolderName;
  final String bankName;
  final String accountNumber;
  final String branchName;
  final String ifscCode;
  final String verificationStatus;

  const VendorBankAccount({
    required this.id,
    required this.accountHolderName,
    required this.bankName,
    required this.accountNumber,
    required this.branchName,
    required this.ifscCode,
    required this.verificationStatus,
  });

  factory VendorBankAccount.fromJson(Map<String, dynamic> json) {
    return VendorBankAccount(
      id: json['id']?.toString() ?? '',
      accountHolderName: json['accountHolderName']?.toString() ?? '',
      bankName: json['bankName']?.toString() ?? '',
      accountNumber: json['accountNumber']?.toString() ?? '',
      branchName: json['branchName']?.toString() ?? '',
      ifscCode: json['ifscCode']?.toString() ?? '',
      verificationStatus: json['verificationStatus']?.toString() ?? 'pending',
    );
  }
}

class VendorVerificationRequest {
  final String id;
  final String reviewStatus;
  final String submittedAt;
  final String? rejectionReason;

  const VendorVerificationRequest({
    required this.id,
    required this.reviewStatus,
    required this.submittedAt,
    this.rejectionReason,
  });

  factory VendorVerificationRequest.fromJson(Map<String, dynamic> json) {
    return VendorVerificationRequest(
      id: json['id']?.toString() ?? '',
      reviewStatus: json['reviewStatus']?.toString() ?? '',
      submittedAt: json['submittedAt']?.toString() ?? '',
      rejectionReason: json['rejectionReason']?.toString(),
    );
  }
}

class VendorServiceArea {
  final String id;
  final String areaName;
  final String city;
  final double centerLatitude;
  final double centerLongitude;
  final double serviceRadiusKm;
  final bool isActive;

  const VendorServiceArea({
    required this.id,
    required this.areaName,
    required this.city,
    required this.centerLatitude,
    required this.centerLongitude,
    required this.serviceRadiusKm,
    this.isActive = true,
  });

  factory VendorServiceArea.fromJson(Map<String, dynamic> json) {
    return VendorServiceArea(
      id: json['id']?.toString() ?? '',
      areaName: json['areaName']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      centerLatitude: _toDouble(json['centerLatitude']),
      centerLongitude: _toDouble(json['centerLongitude']),
      serviceRadiusKm: _toDouble(json['serviceRadiusKm']),
      isActive: json['isActive'] != false,
    );
  }
}

class LocationState {
  final String name;
  final String iso2;

  const LocationState({required this.name, required this.iso2});

  factory LocationState.fromJson(Map<String, dynamic> json) {
    return LocationState(
      name: json['name']?.toString() ?? '',
      iso2: json['iso2']?.toString() ?? '',
    );
  }
}

class LocationCity {
  final String name;

  const LocationCity({required this.name});

  factory LocationCity.fromJson(Map<String, dynamic> json) {
    return LocationCity(name: json['name']?.toString() ?? '');
  }
}

const vendorDocumentTypes = [
  'GST Certificate',
  'PAN Card',
  'Trade License',
  'Address Proof',
  'Cancelled Cheque',
];

double _toDouble(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString()) ?? 0;
}
