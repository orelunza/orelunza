/**
 *
 * @file WorldError.cpp
 * @author Softadastra
 * @brief Stable error implementation for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#include <world/errors/WorldError.hpp>

#include <utility>

namespace orelunza::world::errors
{
  std::string_view to_string(
      WorldErrorCode code) noexcept
  {
    switch (code)
    {
    case WorldErrorCode::None:
      return "none";

    case WorldErrorCode::InvalidInput:
      return "invalid_input";

    case WorldErrorCode::InvalidWorldId:
      return "invalid_world_id";

    case WorldErrorCode::InvalidRegionId:
      return "invalid_region_id";

    case WorldErrorCode::InvalidPlaceId:
      return "invalid_place_id";

    case WorldErrorCode::WorldNotFound:
      return "world_not_found";

    case WorldErrorCode::RegionNotFound:
      return "region_not_found";

    case WorldErrorCode::PlaceNotFound:
      return "place_not_found";

    case WorldErrorCode::PositionNotFound:
      return "position_not_found";

    case WorldErrorCode::RegionDisabled:
      return "region_disabled";

    case WorldErrorCode::PlaceDisabled:
      return "place_disabled";

    case WorldErrorCode::StorageError:
      return "storage_error";

    case WorldErrorCode::ConfigurationError:
      return "configuration_error";

    case WorldErrorCode::Unknown:
      return "unknown";
    }

    return "unknown";
  }

  std::string_view to_string(
      const WorldError &error) noexcept
  {
    return to_string(error.code());
  }

  WorldError make_world_ok() noexcept
  {
    return WorldError{};
  }

  WorldError make_world_error(
      WorldErrorCode code,
      std::string message)
  {
    if (code == WorldErrorCode::None)
    {
      return make_world_ok();
    }

    return WorldError{
        code,
        std::move(message)};
  }
} // namespace orelunza::world::errors
