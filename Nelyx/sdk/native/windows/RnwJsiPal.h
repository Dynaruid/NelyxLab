// SPDX-License-Identifier: BSD-3-Clause AND MIT
// Embedded script Copyright (c) Microsoft Corporation. See ../../licenses/react-native-windows-LICENSE.
// RNW0.83.2 embedded JSI manager, from Microsoft.ReactNative/JsiApi.cpp (MIT).
#pragma once
#include <string_view>
namespace Nelyx::WindowsStaticHermes {
inline constexpr std::string_view rnwJsiPalSource=R"JS(
      var __jsi_pal = function() {
        var hostFunctionId = Symbol('hostFunctionId');
        return {
          getHostFunctionId: function(func) { return func[hostFunctionId]; },
          setHostFunctionId: function(func, id) { Object.defineProperty(func, hostFunctionId, { value: id }); }
        };
      }();
    )JS";
inline constexpr std::string_view rnwJsiPalSha256="33b3511fb792121ec490c30de532e436312262808697317764e513ae6ecff3d3";
inline constexpr std::string_view rnwJsiPalUrl="jsi-internal://host-function-manager.js";
}
