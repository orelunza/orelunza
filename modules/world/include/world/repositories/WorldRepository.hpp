/**
 *
 * @file WorldRepository.hpp
 * @author Softadastra
 * @brief Persistence contract for the Orelunza world module.
 *
 * Orelunza source code is licensed under the Apache License 2.0.
 *
 * Copyright 2026 Softadastra.
 * The Orelunza name and official branding are not granted
 * under the Apache License 2.0.
 *
 */

#ifndef ORELUNZA_WORLD_REPOSITORIES_WORLD_REPOSITORY_HPP_INCLUDED
#define ORELUNZA_WORLD_REPOSITORIES_WORLD_REPOSITORY_HPP_INCLUDED

#include <identity/domain/IdentityIds.hpp>

#include <world/domain/HumanPosition.hpp>
#include <world/domain/Place.hpp>
#include <world/domain/Region.hpp>
#include <world/errors/WorldError.hpp>

#include <optional>
#include <utility>
#include <vector>

namespace orelunza::world::repositories
{
  /**
   * @brief Result returned by world repository operations.
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
          errors::make_world_ok()};
    }

    /**
     * @brief Create a failed repository result.
     *
     * @param error Repository error.
     * @return Failed repository result.
     */
    [[nodiscard]] static RepositoryResult failure(
        errors::WorldError error)
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
      return value_.has_value() && !error_.has_error();
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
     * @brief Return the operation error.
     *
     * @return Repository error.
     */
    [[nodiscard]] const errors::WorldError &error() const noexcept
    {
      return error_;
    }

  private:
    RepositoryResult(
        std::optional<T> value,
        errors::WorldError error)
        : value_(std::move(value)),
          error_(std::move(error))
    {
    }

    std::optional<T> value_;
    errors::WorldError error_;
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
          errors::make_world_ok()};
    }

    /**
     * @brief Create a failed repository status.
     *
     * @param error Repository error.
     * @return Failed status.
     */
    [[nodiscard]] static RepositoryStatus failure(
        errors::WorldError error)
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
     * @brief Return the operation error.
     *
     * @return Repository error.
     */
    [[nodiscard]] const errors::WorldError &error() const noexcept
    {
      return error_;
    }

  private:
    explicit RepositoryStatus(errors::WorldError error)
        : error_(std::move(error))
    {
    }

    errors::WorldError error_;
  };

  /**
   * @brief Persistence contract for regions, places, and human positions.
   */
  class WorldRepository
  {
  public:
    virtual ~WorldRepository() = default;

    /**
     * @brief Persist a new region.
     *
     * @param region Region to create.
     * @return Repository operation status.
     */
    virtual RepositoryStatus create_region(
        const domain::Region &region) = 0;

    /**
     * @brief Persist changes to an existing region.
     *
     * @param region Updated region.
     * @return Repository operation status.
     */
    virtual RepositoryStatus update_region(
        const domain::Region &region) = 0;

    /**
     * @brief Find a region by identifier.
     *
     * @param id Region identifier.
     * @return Optional region.
     */
    [[nodiscard]] virtual RepositoryResult<
        std::optional<domain::Region>>
    find_region_by_id(
        const domain::RegionId &id) const = 0;

    /**
     * @brief Find a region by slug.
     *
     * @param slug Stable region slug.
     * @return Optional region.
     */
    [[nodiscard]] virtual RepositoryResult<
        std::optional<domain::Region>>
    find_region_by_slug(
        const std::string &slug) const = 0;

    /**
     * @brief List all regions.
     *
     * @return Regions ordered by creation time.
     */
    [[nodiscard]] virtual RepositoryResult<
        std::vector<domain::Region>>
    list_regions() const = 0;

    /**
     * @brief Persist a new place.
     *
     * @param place Place to create.
     * @return Repository operation status.
     */
    virtual RepositoryStatus create_place(
        const domain::Place &place) = 0;

    /**
     * @brief Persist changes to an existing place.
     *
     * @param place Updated place.
     * @return Repository operation status.
     */
    virtual RepositoryStatus update_place(
        const domain::Place &place) = 0;

    /**
     * @brief Find a place by identifier.
     *
     * @param id Place identifier.
     * @return Optional place.
     */
    [[nodiscard]] virtual RepositoryResult<
        std::optional<domain::Place>>
    find_place_by_id(
        const domain::PlaceId &id) const = 0;

    /**
     * @brief List places belonging to a region.
     *
     * @param region_id Region identifier.
     * @return Places ordered by creation time.
     */
    [[nodiscard]] virtual RepositoryResult<
        std::vector<domain::Place>>
    list_places_by_region(
        const domain::RegionId &region_id) const = 0;

    /**
     * @brief Create or update a human world position.
     *
     * @param position Human position.
     * @return Repository operation status.
     */
    virtual RepositoryStatus save_human_position(
        const domain::HumanPosition &position) = 0;

    /**
     * @brief Find the current position of a human.
     *
     * @param human_id Human identifier.
     * @return Optional human position.
     */
    [[nodiscard]] virtual RepositoryResult<
        std::optional<domain::HumanPosition>>
    find_human_position(
        const identity::domain::HumanId &human_id) const = 0;
  };
} // namespace orelunza::world::repositories

#endif // ORELUNZA_WORLD_REPOSITORIES_WORLD_REPOSITORY_HPP_INCLUDED
