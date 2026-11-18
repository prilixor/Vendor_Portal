import 'package:flutter_test/flutter_test.dart';
import 'package:prilixor_mobile/core/utils/stable_media_url.dart';

void main() {
  const previous =
      'https://bucket.s3.amazonaws.com/uploads/a_thumb.jpg?X-Amz-Date=20261118T120000Z&X-Amz-Expires=7200&X-Amz-Signature=old';
  const refreshed =
      'https://bucket.s3.amazonaws.com/uploads/a_thumb.jpg?X-Amz-Date=20261118T120500Z&X-Amz-Expires=7200&X-Amz-Signature=new';
  const otherFile =
      'https://bucket.s3.amazonaws.com/uploads/b.jpg?X-Amz-Date=20261118T120500Z&X-Amz-Expires=7200&X-Amz-Signature=new';

  test('keeps the signed url already on screen', () {
    final now = DateTime.utc(2026, 11, 18, 12, 5);
    expect(keepStableMediaUrl(previous, refreshed, now), previous);
    expect(mediaObjectKey(previous), mediaObjectKey(refreshed));
  });

  test('switches immediately when the file changes', () {
    final now = DateTime.utc(2026, 11, 18, 12, 5);
    expect(keepStableMediaUrl(previous, otherFile, now), otherFile);
  });

  test('takes a fresh signature in the last minute before expiry', () {
    final now = DateTime.utc(2026, 11, 18, 13, 59, 30);
    expect(keepStableMediaUrl(previous, refreshed, now), refreshed);
  });
}
