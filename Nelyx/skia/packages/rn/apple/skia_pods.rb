# SPDX-License-Identifier: BSD-3-Clause
require 'digest'
require 'fileutils'
require 'json'
require 'open3'
require 'pathname'

module NelyxAppleSkia
  VERSION = '154.1.0'.freeze
  PACKAGES = {
    'ios' => 'react-native-skia-graphite-apple-ios',
    'macos' => 'react-native-skia-graphite-apple-macos'
  }.freeze
  FRAMEWORKS = %w[libskia libsvg libskshaper libskparagraph libskunicode_core
                  libskunicode_libgrapheme libskottie libsksg].freeze

  def self.resolve_package(name, base)
    script = "process.stdout.write(require('path').dirname(require.resolve(process.argv[1] + '/package.json')))"
    output, error, status = Open3.capture3('node', '-e', script, name, chdir: base)
    return output.strip if status.success?
    return nil if error.include?('MODULE_NOT_FOUND')
    raise "Nelyx Apple: cannot resolve #{name}: #{error}"
  end

  # Include link identities in the digest, but never copy a link escaping its input.
  def self.tree_digest(directory)
    root = File.realpath(directory)
    digest = Digest::SHA256.new
    Dir.glob(File.join(root, '**', '*'), File::FNM_DOTMATCH).sort.each do |file|
      relative = Pathname.new(file).relative_path_from(Pathname.new(root)).to_s
      next if File.directory?(file) && !File.symlink?(file)
      digest.update(relative).update("\0")
      if File.symlink?(file)
        resolved = File.realpath(file)
        raise "Nelyx Apple: framework link escapes input: #{relative}" unless resolved.start_with?(root + '/')
        digest.update('link:').update(File.readlink(file))
      else
        digest.update(Digest::SHA256.file(file).hexdigest)
      end
      digest.update("\0")
    end
    digest.hexdigest
  end

  def self.frameworks(base, environment = ENV, resolver: method(:resolve_package))
    lock_file = File.join(base, 'apple', 'native-supply.json')
    raise 'Nelyx Apple: pinned native-supply.json is missing; prepare the owned RN package' unless File.file?(lock_file)
    lock = JSON.parse(File.read(lock_file))
    raise 'Nelyx Apple: incompatible native supply recipe' unless lock['schema'] == 'nelyx.apple-skia-supply/v1' && lock['version'] == VERSION
    requested = environment['NELYX_APPLE_TARGET']
    targets = requested ? requested.split(',').map(&:strip).uniq : PACKAGES.keys.select { |t| resolver.call(PACKAGES.fetch(t), base) }
    raise 'Nelyx Apple: set NELYX_APPLE_TARGET=ios or macos in the Podfile and install that target binary package' if targets.empty?
    raise "Nelyx Apple: unsupported target #{requested}" unless (targets - PACKAGES.keys).empty?

    # Package presence does not establish that another Pod links Dawn on this target.
    provider = environment.fetch('NELYX_APPLE_DAWN_PROVIDER', 'skia')
    raise 'Nelyx Apple: Dawn provider must be skia or webgpu' unless %w[skia webgpu].include?(provider)
    if environment['RNSKIA_VENDOR_DAWN'] == '1' && provider != 'skia'
      raise 'Nelyx Apple: RNSKIA_VENDOR_DAWN=1 conflicts with the selected Dawn provider'
    end
    webgpu = provider == 'webgpu' ? resolver.call('react-native-webgpu', base) : nil
    raise 'Nelyx Apple: explicit webgpu Dawn provider is not installed' if provider == 'webgpu' && webgpu.nil?

    targets.to_h do |target|
      pin = lock.fetch('targets').fetch(target)
      package_name = PACKAGES.fetch(target)
      package_dir = resolver.call(package_name, base)
      raise "Nelyx Apple: install #{package_name}@#{VERSION} for #{target}" if package_dir.nil?
      package = JSON.parse(File.read(File.join(package_dir, 'package.json')))
      raise "Nelyx Apple: #{package_name} must be #{VERSION}, got #{package['version']}" unless package['version'] == VERSION
      raise "Nelyx Apple: supplier package identity mismatch for #{target}" unless package['name'] == package_name && pin['package'] == package_name && package['skia'].is_a?(Hash) && package['skia']['version'] == pin['skiaVersion']
      source = File.join(package_dir, 'libs')
      dawn_marker = File.join(source, '.dawn-version')
      raise "Nelyx Apple: #{package_name} has no Dawn identity marker" unless File.file?(dawn_marker)
      dawn = File.read(dawn_marker).strip
      raise "Nelyx Apple: #{package_name} has an empty Dawn identity" if dawn.empty?
      raise "Nelyx Apple: unpinned Dawn identity for #{target}" unless dawn == pin['dawnVersion']
      if webgpu
        field = JSON.parse(File.read(File.join(webgpu, 'package.json')))['dawn'].to_s
        raise 'Nelyx Apple: selected webgpu has no Dawn identity' if field.empty?
        raise "Nelyx Apple: Dawn identity mismatch for #{target}" unless dawn == "dawn-#{field.tr('/', '-')}"
      end

      names = FRAMEWORKS + (provider == 'skia' ? ['libwebgpu_dawn'] : [])
      hashes = names.to_h do |name|
        directory = File.join(source, name + '.xcframework')
        raise "Nelyx Apple: missing #{target}/#{name}.xcframework" unless File.file?(File.join(directory, 'Info.plist'))
        hash = tree_digest(directory)
        raise "Nelyx Apple: supplier bytes differ from pinned #{target}/#{name}" unless pin.fetch('frameworks').fetch(name) == hash
        [name, hash]
      end
      identity = {'package' => package_name, 'version' => VERSION, 'dawn' => dawn,
                  'dawnProvider' => provider, 'frameworks' => hashes,
                  'supplierArchiveSha256' => pin.fetch('archiveSha256')}
      key = Digest::SHA256.hexdigest(JSON.generate(identity))
      destination = File.join(base, 'libs', target, key)
      if Dir.exist?(destination)
        marker = File.join(destination, 'nelyx-inputs.json')
        raise 'Nelyx Apple: incomplete retained framework input' unless File.file?(marker) && JSON.parse(File.read(marker)) == identity
        hashes.each do |name, hash|
          raise "Nelyx Apple: modified retained #{name} input" unless tree_digest(File.join(destination, name + '.xcframework')) == hash
        end
      else
        FileUtils.mkdir_p(File.dirname(destination))
        Dir.mkdir(destination)
        names.each { |name| FileUtils.cp_r(File.join(source, name + '.xcframework'), destination) }
        hashes.each do |name, hash|
          raise "Nelyx Apple: #{name} changed while staging" unless tree_digest(File.join(destination, name + '.xcframework')) == hash
        end
        File.write(File.join(destination, 'nelyx-inputs.json'), JSON.pretty_generate(identity) + "\n")
      end
      paths = names.map { |name| Pathname.new(File.join(destination, name + '.xcframework')).relative_path_from(Pathname.new(base)).to_s }
      [target, paths]
    end
  end
end
