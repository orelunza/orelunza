/**
 *
 * @file NatureDtos.hpp
 * @author Softadastra
 * @brief HTTP data transfer objects for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_NATURE_HTTP_NATURE_DTOS_HPP_INCLUDED
#define ORELUNZA_NATURE_HTTP_NATURE_DTOS_HPP_INCLUDED

#include <nature/domain/Biome.hpp>
#include <nature/domain/EnvironmentState.hpp>
#include <nature/domain/NaturalArea.hpp>
#include <nature/services/NatureService.hpp>

#include <cstdint>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace orelunza::nature::http
{
  /**
   * @brief Public HTTP representation of a biome.
   */
  struct BiomeResponse
  {
    std::string id;
    std::string name;
    std::string slug;
    std::string description;
    std::string terrain_type;
    std::string vegetation_type;

    bool enabled = true;

    std::int64_t created_at = 0;
    std::int64_t updated_at = 0;

    /**
     * @brief Build a response from a biome domain model.
     *
     * @param biome Biome domain model.
     * @return Biome response.
     */
    [[nodiscard]] static BiomeResponse from_domain(
        const domain::Biome &biome)
    {
      return BiomeResponse{
          biome.id().value(),
          biome.name(),
          biome.slug(),
          biome.description(),
          biome.terrain_type(),
          biome.vegetation_type(),
          biome.enabled(),
          biome.created_at(),
          biome.updated_at()};
    }
  };

  /**
   * @brief Public HTTP representation of a natural area.
   */
  struct NaturalAreaResponse
  {
    std::string id;
    std::string biome_id;
    std::string region_id;
    std::optional<std::string> place_id;

    std::string name;
    std::string description;

    bool enabled = true;

    std::int64_t created_at = 0;
    std::int64_t updated_at = 0;

    /**
     * @brief Build a response from a natural area domain model.
     *
     * @param area Natural area domain model.
     * @return Natural area response.
     */
    [[nodiscard]] static NaturalAreaResponse from_domain(
        const domain::NaturalArea &area)
    {
      std::optional<std::string> place_id;

      if (area.has_place())
      {
        place_id = area.place_id()->value();
      }

      return NaturalAreaResponse{
          area.id().value(),
          area.biome_id().value(),
          area.region_id().value(),
          std::move(place_id),
          area.name(),
          area.description(),
          area.enabled(),
          area.created_at(),
          area.updated_at()};
    }
  };

  /**
   * @brief Public HTTP representation of an environment state.
   */
  struct EnvironmentStateResponse
  {
    std::string natural_area_id;

    std::string terrain_condition;
    std::string vegetation_condition;
    std::string ambient_description;

    std::int32_t vegetation_density = 0;
    std::int32_t water_level = 0;

    std::int64_t updated_at = 0;

    /**
     * @brief Build a response from an environment state domain model.
     *
     * @param state Environment state domain model.
     * @return Environment state response.
     */
    [[nodiscard]] static EnvironmentStateResponse from_domain(
        const domain::EnvironmentState &state)
    {
      return EnvironmentStateResponse{
          state.natural_area_id().value(),
          state.terrain_condition(),
          state.vegetation_condition(),
          state.ambient_description(),
          state.vegetation_density(),
          state.water_level(),
          state.updated_at()};
    }
  };

  /**
   * @brief Public HTTP representation of Orelunza nature.
   */
  struct NatureResponse
  {
    std::vector<BiomeResponse> biomes;

    /**
     * @brief Build a response from the nature overview.
     *
     * @param overview Nature overview.
     * @return Nature response.
     */
    [[nodiscard]] static NatureResponse from_service(
        const services::NatureOverview &overview)
    {
      NatureResponse response;
      response.biomes.reserve(overview.biomes.size());

      for (const auto &biome : overview.biomes)
      {
        response.biomes.push_back(
            BiomeResponse::from_domain(biome));
      }

      return response;
    }
  };

  /**
   * @brief Standard nature module error response.
   */
  struct ErrorResponse
  {
    bool ok = false;
    std::string error;
    std::string message;
  };
} // namespace orelunza::nature::http

#endif // ORELUNZA_NATURE_HTTP_NATURE_DTOS_HPP_INCLUDED
