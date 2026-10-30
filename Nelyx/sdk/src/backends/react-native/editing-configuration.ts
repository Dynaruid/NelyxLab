// SPDX-License-Identifier: BSD-3-Clause
import type { EditingConfiguration } from '@nelyx/core/hosting/interaction';
/** Native public TextInput props; the Android observed editor consumes the full configuration directly. */
export function nativeEditingConfiguration(
  configuration: EditingConfiguration,
  platform: string,
): Record<string, unknown> {
  const hint = configuration.readOnly ? undefined : configuration.autofillHints?.[0];
  const props: Record<string, unknown> = {
    multiline: configuration.multiline,
    secureTextEntry: configuration.obscureText,
    autoCorrect: configuration.autocorrect,
    spellCheck: configuration.enableSuggestions,
    autoCapitalize: configuration.capitalization,
    keyboardType: (
      {
        text: 'default',
        number: 'numeric',
        decimal: 'decimal-pad',
        phone: 'phone-pad',
        email: 'email-address',
        url: 'url',
      } as const
    )[configuration.keyboardType],
    autoComplete: hint ?? 'off',
  };
  if (platform === 'android') props.importantForAutofill = hint ? 'yes' : 'no';
  if (platform === 'ios')
    props.textContentType = hint
      ? ((
          {
            'current-password': 'password',
            'new-password': 'newPassword',
            'one-time-code': 'oneTimeCode',
            email: 'emailAddress',
            tel: 'telephoneNumber',
            'street-address': 'fullStreetAddress',
            'postal-code': 'postalCode',
          } as Record<string, string>
        )[hint] ?? hint)
      : 'none';
  return props;
}
