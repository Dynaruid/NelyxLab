// SPDX-License-Identifier: BSD-3-Clause
import { X509Certificate } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { capture } from '../../Nelyx/sdk/tooling/cli/src/commands.mjs';

export function configuredIosDevelopmentTeam(app) {
  const file = path.join(app, 'platform', 'ios', 'tauri.conf.json');
  try {
    const { bundle } = JSON.parse(fs.readFileSync(file, 'utf8'));
    const ios = bundle?.iOS ?? bundle?.ios;
    return ios?.developmentTeam ?? ios?.['development-team'];
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function iosSigningTeams() {
  const identities = capture('security', ['find-identity', '-v', '-p', 'codesigning']);
  const fingerprints = new Set(
    Array.from(identities.matchAll(/^\s*\d+\)\s+([0-9A-F]{40})\s+"/gm), ([, hash]) => hash),
  );
  if (!fingerprints.size) return [];

  const certificates = capture('security', ['find-certificate', '-a', '-p']);
  const teams = new Map();
  for (const [pem] of certificates.matchAll(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
  )) {
    const certificate = new X509Certificate(pem);
    if (!fingerprints.has(certificate.fingerprint.replaceAll(':', ''))) continue;
    const { CN, O, OU } = certificate.toLegacyObject().subject;
    if (!/^(?:Apple Development|iPhone Developer):/.test(CN) || !/^[A-Z0-9]{10}$/.test(OU))
      continue;
    // The organizational unit is the Team ID. The common name can contain a member ID.
    teams.set(OU, { id: OU, name: O ?? 'Apple Development' });
  }
  return [...teams.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}
