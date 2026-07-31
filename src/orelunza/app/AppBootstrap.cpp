/**
 * @file AppBootstrap.cpp
 * @brief Startup implementation for the orelunza backend.
 */

#include <orelunza/app/AppBootstrap.hpp>
#include <orelunza/presentation/middleware/MiddlewareRegistry.hpp>
#include <orelunza/presentation/routes/RouteRegistry.hpp>

#include <vix_app_modules.hpp>

#include <vix.hpp>
#include <vix/executor/RuntimeExecutor.hpp>
#include <vix/log.hpp>

#include <memory>

namespace orelunza::app
{
  int AppBootstrap::run()
  {
    vix::config::Config cfg{".env"};

    auto executor = std::make_shared<vix::executor::RuntimeExecutor>(1u);
    vix::App app{executor};

    presentation::middleware::MiddlewareRegistry::register_all(app);
    presentation::routes::RouteRegistry::register_all(app);
    vix::app_generated::register_app_modules(app);

    vix::log::info("Starting orelunza on port {}", cfg.getServerPort());

    return vix::app_generated::run_app(app, cfg, executor);
  }
} // namespace orelunza::app
