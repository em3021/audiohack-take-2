(function() {
  var App;

  App = (function() {
    function App(options) {
      var defaults = {};
      this.options = $.extend(defaults, options);
      this.init();
    }

    App.prototype.init = function(){
      var _this = this;

           
    };

    return App;

  })();

  $(function() {
    return new App({});
  });

}).call(this);
