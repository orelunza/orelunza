/**
 *
 * @file NatureError.cpp
 * @author Softadastra
 * @brief Stable error implementation for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <nature/errors/NatureError.hpp>

#include <utility>

namespace orelunza::nature::errors
{
  std::string_view to_string(
      NatureErrorCode code) noexcept
  {
    switch (code)
    {
    case NatureErrorCode::None:
      return "none";

    case NatureErrorCode::InvalidInput:
      return "invalid_input";

    case NatureErrorCode::InvalidBiomeId:
      return "invalid_biome_id";

    case NatureErrorCode::InvalidNaturalAreaId:
      return "invalid_natural_area_id";

    case NatureErrorCode::InvalidRegionId:
      return "invalid_region_id";

    case NatureErrorCode::InvalidPlaceId:
      return "invalid_place_id";

    case NatureErrorCode::BiomeNotFound:
      return "biome_not_found";

    case NatureErrorCode::NaturalAreaNotFound:
      return "natural_area_not_found";

    case NatureErrorCode::EnvironmentStateNotFound:
      return "environment_state_not_found";

    case NatureErrorCode::RegionNotFound:
      return "region_not_found";

    case NatureErrorCode::PlaceNotFound:
      return "place_not_found";

    case NatureErrorCode::BiomeDisabled:
      return "biome_disabled";

    case NatureErrorCode::NaturalAreaDisabled:
      return "natural_area_disabled";

    case NatureErrorCode::StorageError:
      return "storage_error";

    case NatureErrorCode::ConfigurationError:
      return "configuration_error";

    case NatureErrorCode::Unknown:
      return "unknown";
    }

    return "unknown";
  }

  std::string_view to_string(
      const NatureError &error) noexcept
  {
    return to_string(error.code());
  }

  NatureError make_nature_ok() noexcept
  {
    return NatureError{};
  }

  NatureError make_nature_error(
      NatureErrorCode code,
      std::string message)
  {
    if (code == NatureErrorCode::None)
    {
      return make_nature_ok();
    }

    return NatureError{
        code,
        std::move(message)};
  }
} // namespace orelunza::nature::errors
