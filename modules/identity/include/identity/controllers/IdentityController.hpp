#ifndef orelunza_identity_controller_hpp
#define orelunza_identity_controller_hpp

namespace vix
{
  class App;
}

namespace orelunza::identity::controllers
{
  class IdentityController
  {
  public:
    static void register_routes(vix::App &app);
  };
} // namespace orelunza::identity::controllers

#endif // orelunza_identity_controller_hpp
