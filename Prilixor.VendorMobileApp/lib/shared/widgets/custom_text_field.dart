import 'package:flutter/material.dart';

import '../../core/theme.dart';
import 'required_field_ux.dart';

class CustomTextField extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isPassword;
  final bool required;
  final String? errorText;
  final TextEditingController controller;
  final Function(String)? onSubmitted;
  final ValueChanged<String>? onChanged;
  final TextInputAction? textInputAction;
  final FocusNode? focusNode;
  final TextInputType? keyboardType;

  const CustomTextField({
    super.key,
    required this.label,
    required this.icon,
    this.isPassword = false,
    this.required = false,
    this.errorText,
    required this.controller,
    this.onSubmitted,
    this.onChanged,
    this.textInputAction,
    this.focusNode,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return TextField(
      controller: controller,
      focusNode: focusNode,
      obscureText: isPassword,
      onSubmitted: onSubmitted,
      onChanged: onChanged,
      textInputAction: textInputAction,
      keyboardType: keyboardType,
      style: TextStyle(color: colors.textPrimary),
      decoration: requiredInputDecoration(
        context,
        label: label,
        required: required,
        errorText: errorText,
        prefixIcon: icon,
      ).copyWith(
        prefixIcon: Icon(icon, color: AppTheme.accent),
      ),
    );
  }
}
