import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/vendor_onboarding_model.dart';
import '../models/vendor_profile_model.dart';
import '../utils/multipart_file_util.dart';

class VendorOnboardingProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _loading = false;
  bool get loading => _loading;

  bool _saving = false;
  bool get saving => _saving;

  String? _error;
  String? get error => _error;

  List<VendorDocument> _documents = [];
  List<VendorDocument> get documents => _documents;

  List<VendorBankAccount> _bankAccounts = [];
  VendorBankAccount? get primaryBank =>
      _bankAccounts.isNotEmpty ? _bankAccounts.first : null;

  List<VendorVerificationRequest> _verificationRequests = [];
  VendorVerificationRequest? get latestVerification =>
      _verificationRequests.isNotEmpty ? _verificationRequests.first : null;

  bool get isVerified {
    final docsOk = _documents.isNotEmpty &&
        _documents.every((d) => d.verificationStatus.toLowerCase() == 'approved');
    final bankOk = _bankAccounts.any(
      (b) => b.verificationStatus.toLowerCase() == 'approved',
    );
    return docsOk && bankOk;
  }

  bool get hasRejectedVerificationItems =>
      _documents.any((d) => d.verificationStatus.toLowerCase() == 'rejected') ||
      _bankAccounts.any((b) => b.verificationStatus.toLowerCase() == 'rejected');

  List<VendorDocument> get rejectedDocuments => _documents
      .where((d) => d.verificationStatus.toLowerCase() == 'rejected')
      .toList();

  List<String> get rejectedDocumentTypes =>
      rejectedDocuments.map((d) => d.documentType).toList();

  bool get hasRejectedBankAccount =>
      _bankAccounts.any((b) => b.verificationStatus.toLowerCase() == 'rejected');

  Future<void>? _loadAllInflight;

  Future<void> loadAll(String vendorId, {bool silent = false}) async {
    if (vendorId.isEmpty) return;
    if (_loadAllInflight != null) return _loadAllInflight!;
    _loadAllInflight = _loadAllInternal(vendorId, silent: silent);
    try {
      await _loadAllInflight;
    } finally {
      _loadAllInflight = null;
    }
  }

  Future<void> _loadAllInternal(String vendorId, {bool silent = false}) async {
    if (!silent) {
      _loading = true;
      _error = null;
      notifyListeners();
    }
    try {
      final results = await Future.wait([
        _api.dio.get('/vendors/$vendorId/documents'),
        _api.dio.get('/vendors/$vendorId/bank-accounts'),
        _api.dio.get('/vendors/$vendorId/verification-requests'),
      ]);
      _documents = _parseList(results[0].data)
          .map((e) => VendorDocument.fromJson(e))
          .toList();
      _bankAccounts = _parseList(results[1].data)
          .map((e) => VendorBankAccount.fromJson(e))
          .toList();
      _verificationRequests = _parseList(results[2].data)
          .map((e) => VendorVerificationRequest.fromJson(e))
          .toList()
        ..sort((a, b) => b.submittedAt.compareTo(a.submittedAt));
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to load onboarding data.');
    } catch (_) {
      _error = 'Failed to load onboarding data.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> saveFullProfile(String vendorId, VendorProfile profile) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.put('/vendors/$vendorId/profile', data: profile.toUpsertPayload());
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to save profile.');
      return false;
    } catch (_) {
      _error = 'Failed to save profile.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<bool> uploadDocument({
    required String vendorId,
    required String documentType,
    required PlatformFile file,
  }) async {
    if (_documents.any((d) => d.documentType == documentType)) {
      _error = 'A document of this type already exists.';
      notifyListeners();
      return false;
    }
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      final multipart = await multipartFromPlatformFile(file);
      if (multipart == null) {
        _error = kIsWeb
            ? 'Could not read the selected file in the browser. Try again or use a smaller PDF/image.'
            : 'Could not read the selected file.';
        return false;
      }

      final uploadForm = FormData.fromMap({
        'vendorId': vendorId,
        'folderType': 'Documents',
        'file': multipart,
      });
      final uploadRes = await _api.dio.post('/files/upload', data: uploadForm);
      if (uploadRes.data is! Map) {
        _error = 'Upload failed.';
        return false;
      }
      final uploadMap = Map<String, dynamic>.from(uploadRes.data as Map);
      final fileUrl =
          uploadMap['storageKey']?.toString() ?? uploadMap['fileUrl']?.toString() ?? '';

      await _api.dio.post(
        '/vendors/$vendorId/documents',
        data: {
          'vendorId': vendorId,
          'documentType': documentType,
          'fileUrl': fileUrl,
          'originalFileName': file.name,
        },
      );
      await loadAll(vendorId);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to upload document.');
      return false;
    } catch (_) {
      _error = 'Failed to upload document.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<bool> deleteDocument(String vendorId, String documentId) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.delete('/vendors/$vendorId/documents/$documentId');
      await loadAll(vendorId);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to delete document.');
      return false;
    } catch (_) {
      _error = 'Failed to delete document.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<Map<String, String>?> lookupIfsc(String ifsc) async {
    if (ifsc.length != 11) return null;
    try {
      final dio = Dio();
      final response = await dio.get('https://ifsc.razorpay.com/$ifsc');
      if (response.data is Map) {
        final map = Map<String, dynamic>.from(response.data as Map);
        return {
          'bankName': map['BANK']?.toString() ?? '',
          'branchName': map['BRANCH']?.toString() ?? '',
        };
      }
    } catch (_) {}
    return null;
  }

  Future<bool> saveBankAccount({
    required String vendorId,
    required String accountHolderName,
    required String bankName,
    required String accountNumber,
    required String branchName,
    required String ifscCode,
    String? bankAccountId,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      final payload = {
        'vendorId': vendorId,
        'accountHolderName': accountHolderName.trim(),
        'bankName': bankName.trim(),
        'accountNumber': accountNumber.trim(),
        'branchName': branchName.trim(),
        'ifscCode': ifscCode.trim().toUpperCase(),
      };
      if (bankAccountId != null && bankAccountId.isNotEmpty) {
        await _api.dio.put(
          '/vendors/$vendorId/bank-accounts/$bankAccountId',
          data: {...payload, 'bankAccountId': bankAccountId},
        );
      } else {
        await _api.dio.post('/vendors/$vendorId/bank-accounts', data: payload);
      }
      await loadAll(vendorId);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to save bank account.');
      return false;
    } catch (_) {
      _error = 'Failed to save bank account.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  Future<bool> submitVerification(String vendorId) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      await _api.dio.post(
        '/vendors/$vendorId/verification-requests',
        data: {'vendorId': vendorId},
      );
      await loadAll(vendorId);
      return true;
    } on DioException catch (e) {
      _error = _dioMessage(e, 'Failed to submit for verification.');
      return false;
    } catch (_) {
      _error = 'Failed to submit for verification.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  List<Map<String, dynamic>> _parseList(dynamic data) {
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  String _dioMessage(DioException e, String fallback) {
    final data = e.response?.data;
    if (data is Map) {
      final detail = data['detail'] ?? data['message'] ?? data['title'];
      if (detail != null && detail.toString().trim().isNotEmpty) {
        return detail.toString();
      }
    }
    return fallback;
  }
}
