# SPDX-License-Identifier: BSD-3-Clause
require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
Pod::Spec.new do |s|
  s.name = 'NelyxPlatformServices'
  s.version = package['version']
  s.summary = 'Native platform services for the Nelyx SDK'
  s.homepage = 'https://github.com/Dynaruid/NelyxLab'
  s.authors = 'Nelyx contributors'
  s.license = { :type => 'BSD-3-Clause', :file => 'LICENSE.md' }
  # Consumers install the supplied SDK archive and use the local Podfile :path.
  s.source = { :git => 'https://github.com/Dynaruid/NelyxLab.git' }
  s.platforms = { :ios => '15.1', :osx => '14.0' }
  s.source_files = 'native/apple/NelyxPlatformServices.m'
  s.requires_arc = true
  s.dependency 'React-Core'
end
