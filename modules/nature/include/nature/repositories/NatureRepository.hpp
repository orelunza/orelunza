/**
 *
 * @file NatureRepository.hpp
 * @author Softadastra
 * @brief Persistence contract for the Orelunza nature module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_NATURE_REPOSITORIES_NATURE_REPOSITORY_HPP_INCLUDED
#define ORELUNZA_NATURE_REPOSITORIES_NATURE_REPOSITORY_HPP_INCLUDED

#include <nature/domain/Biome.hpp>
#include <nature/domain/EnvironmentState.hpp>
#include <nature/domain/NaturalArea.hpp>
#include <nature/errors/NatureError.hpp>

#include <world/domain/WorldIds.hpp>

#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace orelunza::nature::repositories
{
  /**
   * @brief Result returned by nature repository operations.
   *
   * @tparam T Successful value type.
   */
  template <typename T>
  class RepositoryResult
  {
  public:
    /**
     * @brief Create a successful repository result.
     *
     * @param value Successful result value.
     * @return Successful repository result.
     */
    [[nodiscard]] static RepositoryResult success(T value)
    {
      return RepositoryResult{
          std::move(value),
          errors::make_nature_ok()};
    }

    /**
     * @brief Create a failed repository result.
     *
     * @param error Repository error.
     * @return Failed repository result.
     */
    [[nodiscard]] static RepositoryResult failure(
        errors::NatureError error)
    {
      return RepositoryResult{
          std::nullopt,
          std::move(error)};
    }

    /**
     * @brief Return whether the operation succeeded.
     *
     * @return true when a value is available.
     */
    [[nodiscard]] bool ok() const noexcept
    {
      return value_.has_value() &&
             !error_.has_error();
    }

    /**
     * @brief Return whether the operation failed.
     *
     * @return true when the operation failed.
     */
    [[nodiscard]] bool failed() const noexcept
    {
      return !ok();
    }

    /**
     * @brief Return the successful value.
     *
     * @return Mutable successful value.
     */
    [[nodiscard]] T &value()
    {
      return value_.value();
    }

    /**
     * @brief Return the successful value.
     *
     * @return Immutable successful value.
     */
    [[nodiscard]] const T &value() const
    {
      return value_.value();
    }

    /**
     * @brief Return the repository error.
     *
     * @return Nature error.
     */
    [[nodiscard]] const errors::NatureError &
    error() const noexcept
    {
      return error_;
    }

  private:
    RepositoryResult(
        std::optional<T> value,
        errors::NatureError error)
        : value_(std::move(value)),
          error_(std::move(error))
    {
    }

    std::optional<T> value_;
    errors::NatureError error_;
  };

  /**
   * @brief Status returned by repository operations without a value.
   */
  class RepositoryStatus
  {
  public:
    /**
     * @brief Create a successful repository status.
     *
     * @return Successful status.
     */
    [[nodiscard]] static RepositoryStatus success()
    {
      return RepositoryStatus{
          errors::make_nature_ok()};
    }

    /**
     * @brief Create a failed repository status.
     *
     * @param error Repository error.
     * @return Failed status.
     */
    [[nodiscard]] static RepositoryStatus failure(
        errors::NatureError error)
    {
      return RepositoryStatus{
          std::move(error)};
    }

    /**
     * @brief Return whether the operation succeeded.
     *
     * @return true when no error is present.
     */
    [[nodiscard]] bool ok() const noexcept
    {
      return !error_.has_error();
    }

    /**
     * @brief Return whether the operation failed.
     *
     * @return true when an error is present.
     */
    [[nodiscard]] bool failed() const noexcept
    {
      return !ok();
    }

    /**
     * @brief Return the repository error.
     *
     * @return Nature error.
     */
    [[nodiscard]] const errors::NatureError &
    error() const noexcept
    {
      return error_;
    }

  private:
    explicit RepositoryStatus(
        errors::NatureError error)
        : error_(std::move(error))
    {
    }

    errors::NatureError error_;
  };

  /**
   * @brief Persistence contract for nature data.
   */
  class NatureRepository
  {
  public:
    virtual ~NatureRepository() = default;

    virtual RepositoryStatus create_biome(
        const domain::Biome &biome) = 0;

    virtual RepositoryStatus update_biome(
        const domain::Biome &biome) = 0;

    [[nodiscard]] virtual RepositoryResult<
        std::optional<domain::Biome>>
    find_biome_by_id(
        const domain::BiomeId &id) const = 0;

    [[nodiscard]] virtual RepositoryResult<
        std::optional<domain::Biome>>
    find_biome_by_slug(
        const std::string &slug) const = 0;

    [[nodiscard]] virtual RepositoryResult<
        std::vector<domain::Biome>>
    list_biomes() const = 0;

    virtual RepositoryStatus create_natural_area(
        const domain::NaturalArea &area) = 0;

    virtual RepositoryStatus update_natural_area(
        const domain::NaturalArea &area) = 0;

    [[nodiscard]] virtual RepositoryResult<
        std::optional<domain::NaturalArea>>
    find_natural_area_by_id(
        const domain::NaturalAreaId &id) const = 0;

    /**
     * @brief Find the region-wide natural area for a region.
     *
     * Place-specific areas are not returned by this operation.
     *
     * @param region_id Region identifier.
     * @return Optional region-wide natural area.
     */
    [[nodiscard]] virtual RepositoryResult<
        std::optional<domain::NaturalArea>>
    find_natural_area_by_region(
        const world::domain::RegionId &region_id) const = 0;

    [[nodiscard]] virtual RepositoryResult<
        std::optional<domain::NaturalArea>>
    find_natural_area_by_place(
        const world::domain::PlaceId &place_id) const = 0;

    [[nodiscard]] virtual RepositoryResult<
        std::vector<domain::NaturalArea>>
    list_natural_areas_by_biome(
        const domain::BiomeId &biome_id) const = 0;

    virtual RepositoryStatus save_environment_state(
        const domain::EnvironmentState &state) = 0;

    [[nodiscard]] virtual RepositoryResult<
        std::optional<domain::EnvironmentState>>
    find_environment_state(
        const domain::NaturalAreaId &natural_area_id) const = 0;
  };
} // namespace orelunza::nature::repositories

#endif // ORELUNZA_NATURE_REPOSITORIES_NATURE_REPOSITORY_HPP_INCLUDED
