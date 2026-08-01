/**
 *
 * @file Biome.hpp
 * @author Softadastra
 * @brief Biome domain model for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_NATURE_DOMAIN_BIOME_HPP_INCLUDED
#define ORELUNZA_NATURE_DOMAIN_BIOME_HPP_INCLUDED

#include <nature/domain/NatureIds.hpp>

#include <cstdint>
#include <string>
#include <string_view>
#include <utility>

namespace orelunza::nature::domain
{
  /**
   * @brief Represents a broad natural environment category.
   *
   * A biome describes the common terrain and vegetation characteristics
   * shared by one or more natural areas.
   */
  class Biome
  {
  public:
    /**
     * @brief Construct an empty biome.
     */
    Biome() = default;

    /**
     * @brief Construct a biome.
     *
     * @param id Biome identifier.
     * @param name Public biome name.
     * @param slug Stable URL-safe biome name.
     * @param description Public biome description.
     * @param terrain_type Stable terrain category.
     * @param vegetation_type Stable vegetation category.
     * @param enabled Whether the biome is available.
     * @param created_at Creation time in epoch seconds.
     * @param updated_at Last update time in epoch seconds.
     */
    Biome(
        BiomeId id,
        std::string name,
        std::string slug,
        std::string description,
        std::string terrain_type,
        std::string vegetation_type,
        bool enabled,
        std::int64_t created_at,
        std::int64_t updated_at)
        : id_(std::move(id)),
          name_(std::move(name)),
          slug_(std::move(slug)),
          description_(std::move(description)),
          terrain_type_(std::move(terrain_type)),
          vegetation_type_(std::move(vegetation_type)),
          enabled_(enabled),
          created_at_(created_at),
          updated_at_(updated_at)
    {
    }

    /**
     * @brief Return the biome identifier.
     *
     * @return Biome identifier.
     */
    [[nodiscard]] const BiomeId &id() const noexcept
    {
      return id_;
    }

    /**
     * @brief Return the public biome name.
     *
     * @return Biome name.
     */
    [[nodiscard]] const std::string &name() const noexcept
    {
      return name_;
    }

    /**
     * @brief Return the stable biome slug.
     *
     * @return Biome slug.
     */
    [[nodiscard]] const std::string &slug() const noexcept
    {
      return slug_;
    }

    /**
     * @brief Return the biome description.
     *
     * @return Biome description.
     */
    [[nodiscard]] const std::string &description() const noexcept
    {
      return description_;
    }

    /**
     * @brief Return the terrain category.
     *
     * @return Terrain type.
     */
    [[nodiscard]] const std::string &
    terrain_type() const noexcept
    {
      return terrain_type_;
    }

    /**
     * @brief Return the vegetation category.
     *
     * @return Vegetation type.
     */
    [[nodiscard]] const std::string &
    vegetation_type() const noexcept
    {
      return vegetation_type_;
    }

    /**
     * @brief Return whether the biome is enabled.
     *
     * @return true when the biome is available.
     */
    [[nodiscard]] bool enabled() const noexcept
    {
      return enabled_;
    }

    /**
     * @brief Return whether the biome is disabled.
     *
     * @return true when the biome is unavailable.
     */
    [[nodiscard]] bool disabled() const noexcept
    {
      return !enabled_;
    }

    /**
     * @brief Return the creation time.
     *
     * @return Creation time in epoch seconds.
     */
    [[nodiscard]] std::int64_t created_at() const noexcept
    {
      return created_at_;
    }

    /**
     * @brief Return the last update time.
     *
     * @return Update time in epoch seconds.
     */
    [[nodiscard]] std::int64_t updated_at() const noexcept
    {
      return updated_at_;
    }

    /**
     * @brief Return whether the biome contains valid domain data.
     *
     * @return true when the biome is valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return id_.valid() &&
             !name_.empty() &&
             !slug_.empty() &&
             !terrain_type_.empty() &&
             !vegetation_type_.empty() &&
             created_at_ >= 0 &&
             updated_at_ >= created_at_;
    }

    /**
     * @brief Test whether this biome has an identifier.
     *
     * @param id Expected biome identifier.
     * @return true when the identifiers match.
     */
    [[nodiscard]] bool has_id(const BiomeId &id) const noexcept
    {
      return id_ == id;
    }

    /**
     * @brief Test whether this biome has a slug.
     *
     * @param slug Expected biome slug.
     * @return true when the slugs match.
     */
    [[nodiscard]] bool has_slug(std::string_view slug) const noexcept
    {
      return slug_ == slug;
    }

    /**
     * @brief Test whether this biome has a terrain type.
     *
     * @param terrain_type Expected terrain type.
     * @return true when the terrain types match.
     */
    [[nodiscard]] bool has_terrain_type(
        std::string_view terrain_type) const noexcept
    {
      return terrain_type_ == terrain_type;
    }

    /**
     * @brief Test whether this biome has a vegetation type.
     *
     * @param vegetation_type Expected vegetation type.
     * @return true when the vegetation types match.
     */
    [[nodiscard]] bool has_vegetation_type(
        std::string_view vegetation_type) const noexcept
    {
      return vegetation_type_ == vegetation_type;
    }

    /**
     * @brief Replace the biome name.
     *
     * @param name New biome name.
     */
    void set_name(std::string name)
    {
      name_ = std::move(name);
    }

    /**
     * @brief Replace the biome slug.
     *
     * @param slug New biome slug.
     */
    void set_slug(std::string slug)
    {
      slug_ = std::move(slug);
    }

    /**
     * @brief Replace the biome description.
     *
     * @param description New biome description.
     */
    void set_description(std::string description)
    {
      description_ = std::move(description);
    }

    /**
     * @brief Replace the terrain type.
     *
     * @param terrain_type New terrain type.
     */
    void set_terrain_type(std::string terrain_type)
    {
      terrain_type_ = std::move(terrain_type);
    }

    /**
     * @brief Replace the vegetation type.
     *
     * @param vegetation_type New vegetation type.
     */
    void set_vegetation_type(std::string vegetation_type)
    {
      vegetation_type_ = std::move(vegetation_type);
    }

    /**
     * @brief Change the biome activation state.
     *
     * @param enabled New activation state.
     */
    void set_enabled(bool enabled) noexcept
    {
      enabled_ = enabled;
    }

    /**
     * @brief Change the last update time.
     *
     * @param updated_at New update time in epoch seconds.
     */
    void set_updated_at(std::int64_t updated_at) noexcept
    {
      updated_at_ = updated_at;
    }

  private:
    BiomeId id_;

    std::string name_;
    std::string slug_;
    std::string description_;
    std::string terrain_type_;
    std::string vegetation_type_;

    bool enabled_ = true;

    std::int64_t created_at_ = 0;
    std::int64_t updated_at_ = 0;
  };
} // namespace orelunza::nature::domain

#endif // ORELUNZA_NATURE_DOMAIN_BIOME_HPP_INCLUDED
