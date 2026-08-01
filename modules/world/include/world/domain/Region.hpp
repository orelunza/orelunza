/**
 *
 * @file Region.hpp
 * @author Softadastra
 * @brief Region domain model for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_WORLD_DOMAIN_REGION_HPP_INCLUDED
#define ORELUNZA_WORLD_DOMAIN_REGION_HPP_INCLUDED

#include <world/domain/WorldIds.hpp>

#include <cstdint>
#include <string>
#include <string_view>
#include <utility>

namespace orelunza::world::domain
{
  /**
   * @brief Represents a large navigable region in Orelunza.
   *
   * A region groups places under a stable public identity such as a forest,
   * valley, village, or city district.
   */
  class Region
  {
  public:
    /**
     * @brief Construct an empty region.
     */
    Region() = default;

    /**
     * @brief Construct a region.
     *
     * @param id Region identifier.
     * @param name Public region name.
     * @param slug Stable URL-safe region name.
     * @param description Public region description.
     * @param enabled Whether the region can be entered.
     * @param created_at Creation time in epoch seconds.
     * @param updated_at Last update time in epoch seconds.
     */
    Region(
        RegionId id,
        std::string name,
        std::string slug,
        std::string description,
        bool enabled,
        std::int64_t created_at,
        std::int64_t updated_at)
        : id_(std::move(id)),
          name_(std::move(name)),
          slug_(std::move(slug)),
          description_(std::move(description)),
          enabled_(enabled),
          created_at_(created_at),
          updated_at_(updated_at)
    {
    }

    /**
     * @brief Return the region identifier.
     *
     * @return Region identifier.
     */
    [[nodiscard]] const RegionId &id() const noexcept
    {
      return id_;
    }

    /**
     * @brief Return the public region name.
     *
     * @return Region name.
     */
    [[nodiscard]] const std::string &name() const noexcept
    {
      return name_;
    }

    /**
     * @brief Return the stable region slug.
     *
     * @return Region slug.
     */
    [[nodiscard]] const std::string &slug() const noexcept
    {
      return slug_;
    }

    /**
     * @brief Return the region description.
     *
     * @return Region description.
     */
    [[nodiscard]] const std::string &description() const noexcept
    {
      return description_;
    }

    /**
     * @brief Return whether the region is enabled.
     *
     * @return true when the region can be used.
     */
    [[nodiscard]] bool enabled() const noexcept
    {
      return enabled_;
    }

    /**
     * @brief Return whether the region is disabled.
     *
     * @return true when the region cannot be used.
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
     * @brief Return whether the region contains valid domain data.
     *
     * @return true when the region is valid.
     */
    [[nodiscard]] bool valid() const noexcept
    {
      return id_.valid() &&
             !name_.empty() &&
             !slug_.empty() &&
             created_at_ >= 0 &&
             updated_at_ >= created_at_;
    }

    /**
     * @brief Test whether this region has an identifier.
     *
     * @param id Expected region identifier.
     * @return true when the identifiers match.
     */
    [[nodiscard]] bool has_id(const RegionId &id) const noexcept
    {
      return id_ == id;
    }

    /**
     * @brief Test whether this region has a slug.
     *
     * @param slug Expected region slug.
     * @return true when the slugs match.
     */
    [[nodiscard]] bool has_slug(std::string_view slug) const noexcept
    {
      return slug_ == slug;
    }

    /**
     * @brief Replace the region name.
     *
     * @param name New region name.
     */
    void set_name(std::string name)
    {
      name_ = std::move(name);
    }

    /**
     * @brief Replace the region slug.
     *
     * @param slug New region slug.
     */
    void set_slug(std::string slug)
    {
      slug_ = std::move(slug);
    }

    /**
     * @brief Replace the region description.
     *
     * @param description New region description.
     */
    void set_description(std::string description)
    {
      description_ = std::move(description);
    }

    /**
     * @brief Change the region activation state.
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
    RegionId id_;

    std::string name_;
    std::string slug_;
    std::string description_;

    bool enabled_ = true;

    std::int64_t created_at_ = 0;
    std::int64_t updated_at_ = 0;
  };
} // namespace orelunza::world::domain

#endif // ORELUNZA_WORLD_DOMAIN_REGION_HPP_INCLUDED
