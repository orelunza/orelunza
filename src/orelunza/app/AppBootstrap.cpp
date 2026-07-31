/**
 * @file AppBootstrap.cpp
 * @brief Startup implementation for the orelunza backend.
 */

#include <orelunza/app/AppBootstrap.hpp>
#include <orelunza/presentation/middleware/MiddlewareRegistry.hpp>
#include <orelunza/presentation/routes/RouteRegistry.hpp>

#include <identity/IdentityModule.hpp>

#include <vix_app_modules.hpp>

#include <vix.hpp>
#include <vix/db/Database.hpp>
#include <vix/executor/RuntimeExecutor.hpp>
#include <vix/log.hpp>

#include <memory>
#include <string>

namespace orelunza::app
{
  int AppBootstrap::run()
  {
    vix::config::Config cfg{".env"};

    auto executor = std::make_shared<vix::executor::RuntimeExecutor>(1u);
    vix::App app{executor};

    auto database = vix::db::Database::sqlite(
        cfg.getString(
            "DATABASE_SQLITE_PATH",
            cfg.getString(
                "database.sqlite_path",
                "storage/orelunza.db")));

    identity::IdentityModule::initialize(database);

    presentation::middleware::MiddlewareRegistry::register_all(app);
    vix::app_generated::register_app_modules(app);
    presentation::routes::RouteRegistry::register_all(app);

    vix::log::info("Starting orelunza on port {}", cfg.getServerPort());

    const int status = vix::app_generated::run_app(app, cfg, executor);

    identity::IdentityModule::shutdown();

    return status;
  }
} // namespace orelunza::app
