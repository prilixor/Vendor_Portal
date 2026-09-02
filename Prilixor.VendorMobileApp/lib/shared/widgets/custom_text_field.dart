import 'package:flutter/material.dart';

import '../../core/theme.dart';
import 'required_field_ux.dart';

class CustomTextField extends StatefulWidget {
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
  final String? hintText;

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
    this.hintText,
  });

  @override
  State<CustomTextField> createState() => _CustomTextFieldState();
}

class _CustomTextFieldState extends State<CustomTextField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final compact = MediaQuery.sizeOf(context).width < 400;
    final obscure = widget.isPassword && _obscure;
    return TextField(
      controller: widget.controller,
      focusNode: widget.focusNode,
      obscureText: obscure,
      onSubmitted: widget.onSubmitted,
      onChanged: widget.onChanged,
      textInputAction: widget.textInputAction,
      keyboardType: widget.keyboardType,
      style: TextStyle(color: colors.textPrimary),
      decoration: requiredInputDecoration(
        context,
        label: widget.label,
        required: widget.required,
        errorText: widget.errorText,
        hintText: widget.hintText,
        prefixIcon: widget.icon,
      ).copyWith(
        prefixIcon: Icon(
          widget.icon,
          color: AppTheme.accent,
          size: compact ? 20 : 24,
        ),
        suffixIcon: widget.isPassword
            ? IconButton(
                tooltip: _obscure ? 'Show password' : 'Hide password',
                onPressed: () => setState(() => _obscure = !_obscure),
                icon: Icon(
                  _obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  color: colors.textSecondary,
                ),
              )
            : null,
      ),
    );
  }
}
