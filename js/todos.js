// An example Parse.js Backbone application based on the todo app by
// [Jérôme Gravel-Niquet](http://jgn.me/). This demo uses Parse to persist
// the todo items and provide user authentication and sessions.

$(document).ready(function() {

  Parse.$ = jQuery;

  // Initialize Parse with your Parse application javascript keys
  Parse.initialize("cfwULV0DDbuYUytwY7Ve9gyrFvKM2jJcGWabPqIU", "lUKeO8vWE2QxQwdAFNZhKpKOW3IhKQyd0YOMghcv");
  //Ti.Facebook.appid = '1459046514407348';
  // Initialize the Facebook SDK with Parse as described at 
  // https://parse.com/docs/js_guide#fbusers
  window.fbAsyncInit = function() {
    // init the FB JS SDK
    Parse.FacebookUtils.init({
      appId      : '1459046514407348', // Facebook App ID
      channelUrl : '//lounge.parseapp.com/channel.html', // Channel File
      status     : true, // check login status
      cookie     : true, // enable cookies to allow Parse to access the session
      xfbml      : true  // parse XFBML
      //version    : 'v2.3'
    });
  };
  // Todo Model
  // ----------

  // Our basic Todo model has `content`, `order`, and `done` attributes.
  var Todo = Parse.Object.extend("Todo", {
    // Default attributes for the todo.
    defaults: {
      content: "empty todo...",
      done: false
    },

    // Ensure that each todo created has `content`.
    initialize: function() {
      if (!this.get("content")) {
        this.set({"content": this.defaults.content});
      }
    },

    // Toggle the `done` state of this todo item.
    toggle: function() {
      this.save({done: !this.get("done")});
    }
  });

  // This is the transient application state, not persisted on Parse
  var AppState = Parse.Object.extend("AppState", {
    defaults: {
      filter: "all"
    }
  });

  // Todo Collection
  // ---------------

  var TodoList = Parse.Collection.extend({

    // Reference to this collection's model.
    model: Todo,

    // Filter down the list of all todo items that are finished.
    done: function() {
      return this.filter(function(todo){ return todo.get('done'); });
    },

    // Filter down the list to only todo items that are still not finished.
    remaining: function() {
      return this.without.apply(this, this.done());
    },

    // We keep the Todos in sequential order, despite being saved by unordered
    // GUID in the database. This generates the next order number for new items.
    nextOrder: function() {
      if (!this.length) return 1;
      return this.last().get('order') + 1;
    },

    // Todos are sorted by their original insertion order.
    comparator: function(todo) {
      return todo.get('order');
    }

  });

  // Todo Item View
  // --------------

  // The DOM element for a todo item...
  var TodoView = Parse.View.extend({

    //... is a list tag.
    tagName:  "li",

    // Cache the template function for a single item.
    template: _.template($('#item-template').html()),

    // The DOM events specific to an item.
    events: {
      "click .toggle"              : "toggleDone",
      "dblclick label.todo-content" : "edit",
      "click .todo-destroy"   : "clear",
      "keypress .edit"      : "updateOnEnter",
      "blur .edit"          : "close"
    },

    // The TodoView listens for changes to its model, re-rendering. Since there's
    // a one-to-one correspondence between a Todo and a TodoView in this
    // app, we set a direct reference on the model for convenience.
    initialize: function() {
      _.bindAll(this, 'render', 'close', 'remove');
      this.model.bind('change', this.render);
      this.model.bind('destroy', this.remove);
    },

    // Re-render the contents of the todo item.
    render: function() {
      $(this.el).html(this.template(this.model.toJSON()));
      this.input = this.$('.edit');
      return this;
    },

    // Toggle the `"done"` state of the model.
    toggleDone: function() {
      this.model.toggle();
    },

    // Switch this view into `"editing"` mode, displaying the input field.
    edit: function() {
      $(this.el).addClass("editing");
      this.input.focus();
    },

    // Close the `"editing"` mode, saving changes to the todo.
    close: function() {
      this.model.save({content: this.input.val()});
      $(this.el).removeClass("editing");
    },

    // If you hit `enter`, we're through editing the item.
    updateOnEnter: function(e) {
      if (e.keyCode == 13) this.close();
    },

    // Remove the item, destroy the model.
    clear: function() {
      this.model.destroy();
    }

  });

  // The Application
  // ---------------

  // The main view that lets a user manage their todo items
  var ManageTodosView = Parse.View.extend({

    // Our template for the line of statistics at the bottom of the app.
    statsTemplate: _.template($('#stats-template').html()),

    // Delegated events for creating new items, and clearing completed ones.
    events: {
      "keypress #new-todo":  "createOnEnter",
      "click #clear-completed": "clearCompleted",
      "click #toggle-all": "toggleAllComplete",
      "click .log-out": "logOut",
      "click ul#filters a": "selectFilter"
    },

    el: ".content",

    // At initialization we bind to the relevant events on the `Todos`
    // collection, when items are added or changed. Kick things off by
    // loading any preexisting todos that might be saved to Parse.
    initialize: function() {
      var self = this;
      _.bindAll(this, 'addOne', 'addAll', 'addSome', 'render', 'toggleAllComplete', 'logOut', 'createOnEnter');

      // Main todo management template
      this.$el.html(_.template($('#manage-todos-template').html()));
      
      this.input = this.$("#new-todo");
      this.allCheckbox = this.$("#toggle-all")[0];

      // Create our collection of Todos
      this.todos = new TodoList;

      // Setup the query for the collection to look for todos from the current user
      this.todos.query = new Parse.Query(Todo);
      this.todos.query.equalTo("user", Parse.User.current());
        
      this.todos.bind('add',     this.addOne);
      this.todos.bind('reset',   this.addAll);
      this.todos.bind('all',     this.render);

      // Fetch all the todo items for this user
      this.todos.fetch();

      state.on("change", this.filter, this);
    },

    // Logs out the user and shows the login view
    logOut: function(e) {
      Parse.User.logOut();
      new LogInView();
      this.undelegateEvents();
      delete this;
    },

    // Re-rendering the App just means refreshing the statistics -- the rest
    // of the app doesn't change.
    render: function() {
      var done = this.todos.done().length;
      var remaining = this.todos.remaining().length;

      this.$('#todo-stats').html(this.statsTemplate({
        total:      this.todos.length,
        done:       done,
        remaining:  remaining
      }));

      this.delegateEvents();

      this.allCheckbox.checked = !remaining;
    },

    // Filters the list based on which type of filter is selected
    selectFilter: function(e) {
      var el = $(e.target);
      var filterValue = el.attr("id");
      state.set({filter: filterValue});
      Parse.history.navigate(filterValue);
    },

    filter: function() {
      var filterValue = state.get("filter");
      this.$("ul#filters a").removeClass("selected");
      this.$("ul#filters a#" + filterValue).addClass("selected");
      if (filterValue === "all") {
        this.addAll();
      } else if (filterValue === "completed") {
        this.addSome(function(item) { return item.get('done') });
      } else {
        this.addSome(function(item) { return !item.get('done') });
      }
    },

    // Resets the filters to display all todos
    resetFilters: function() {
      this.$("ul#filters a").removeClass("selected");
      this.$("ul#filters a#all").addClass("selected");
      this.addAll();
    },

    // Add a single todo item to the list by creating a view for it, and
    // appending its element to the `<ul>`.
    addOne: function(todo) {
      var view = new TodoView({model: todo});
      this.$("#todo-list").append(view.render().el);
    },

    // Add all items in the Todos collection at once.
    addAll: function(collection, filter) {
      this.$("#todo-list").html("");
      this.todos.each(this.addOne);
    },

    // Only adds some todos, based on a filtering function that is passed in
    addSome: function(filter) {
      var self = this;
      this.$("#todo-list").html("");
      this.todos.chain().filter(filter).each(function(item) { self.addOne(item) });
    },

    // If you hit return in the main input field, create new Todo model
    createOnEnter: function(e) {
      var self = this;
      if (e.keyCode != 13) return;

      this.todos.create({
        content: this.input.val(),
        order:   this.todos.nextOrder(),
        done:    false,
        user:    Parse.User.current(),
        ACL:     new Parse.ACL(Parse.User.current())
      });

      this.input.val('');
      this.resetFilters();
    },

    // Clear all done todo items, destroying their models.
    clearCompleted: function() {
      _.each(this.todos.done(), function(todo){ todo.destroy(); });
      return false;
    },

    toggleAllComplete: function () {
      var done = this.allCheckbox.checked;
      this.todos.each(function (todo) { todo.save({'done': done}); });
    }
  });
  
  var LogInView = Parse.View.extend({
    events: {
      "submit form.login-form": "logIn",
      "click .joinLink": "signUpLink",
      "click .LoginButtonWithFacebook": "loginWithFacebook",
      "submit form.signup-form": "signUp"
    },

    el: ".content-log",
    
    initialize: function() {
      _.bindAll(this, "logIn", "signUpLink", "loginWithFacebook", "signUp");
      this.render();
    },

    logIn: function(e) {
      var self = this;
      var email = this.$("#login-email").val();
      var password = this.$("#login-password").val();
      
      Parse.User.logIn(email, password, {
        success: function(user) {
          if (user.get("emailVerified")) {
              new ManageTodosView();
              self.undelegateEvents();
              delete self;
          } else {
              Parse.User.logOut();
              self.$(".login-form .error").html("이메일 주소가 확인되지 않았습니다.").show();
              this.$(".login-form button").removeAttr("disabled");
          }
        },

        error: function(user, error) {
          //self.$(".signup-form .error").html(error.message).show();
          self.$(".login-form .error").html("잘못된 이메일이나 패스워드를 입력하셨습니다.").show();
          self.$(".login-form button").removeAttr("disabled");
        }
      });
      
      this.$(".login-form button").attr("disabled", "disabled");

      return false;
    },
    signUpLink: function(e) {
      this.$(".login-form").hide().removeClass('.focus');
      this.$(".signup-form").show().addClass('.focus');
    },
    loginWithFacebook: function(e) {
      var self = this;
      var session = "<i class='icon-facebook icon-large'></i>&nbsp;페이스북으로 접속";
      self.$(".LoginButtonWithFacebook")
        .addClass("disabled")
        .empty()
        .spin({length: 5, radius: 5, lines: 8, width: 3, color: "#fff"});
      if (Parse.User.current()) {
        new ManageTodosView();
        self.undelegateEvents();
        delete self;
      } else {
        Parse.FacebookUtils.logIn(null, {
          success: function(user) {
            // If it's a new user, let's fetch their name from FB
            if (!user.existed()) {
              // We make a graph request
              FB.api('/me', {scope: scopes}, function(response) {
                if (!response.error) {
                  // We save the data on the Parse user
                  user.set("username", response.id);
                  user.set("email", response.email);
                  user.signUp(null, {
                    success: function(user) {
                      if (user.get("emailVerified")) {
                          new ManageTodosView();
                          self.undelegateEvents();
                          delete self;
                      } else {
                          self.$(".login-form .error").html("메시지를 보냈습니다. 이메일을 확인해주세요!").show();
                          self.$(".LoginButtonWithFacebook").removeClass("disabled").spin().show();
                          self.$(".LoginButtonWithFacebook").after(session);
                          self.$(".LoginButtonWithFacebook a").removeAttr("disabled");
                      }
                    },
                    error: function(user, error) {
                      new ManageTodosView();
                      self.undelegateEvents();
                      delete self;
                    }
                  });
                } else {
                  self.$(".login-form .error").html("페이스북에 문제가 생긴 모양입니다!").show();
                  self.$(".LoginButtonWithFacebook").removeClass("disabled").spin().show();
                  self.$(".LoginButtonWithFacebook").after(session);
                  self.$(".LoginButtonWithFacebook a").removeAttr("disabled");
                }
              });
            // If it's an existing user that was logged in, we save the score
            } else {
              new ManageTodosView();
              self.undelegateEvents();
              delete self;
            }
          },
          error: function(user, error) {
            Parse.User.logOut();
            self.$(".login-form .error").html("작업이 완료되지 않았습니다!").show();
            self.$(".LoginButtonWithFacebook").removeClass("disabled").spin().show();
            self.$(".LoginButtonWithFacebook").after(session);
            self.$(".LoginButtonWithFacebook a").removeAttr("disabled");
          }
        });
        this.$(".LoginButtonWithFacebook a").attr("disabled", "disabled");
      }
      
      return false;
    },
    signUp: function(e) {
      var self = this;
      var email = this.$("#signup-email").val();
      var username = this.$("#signup-username").val();
      var password = this.$("#signup-password").val();
      
      Parse.User.signUp(username, password, {
        ACL: new Parse.ACL(), email: email }, {
        success: function(user) {
          if (user.get("emailVerified")) {
              new ManageTodosView();
              self.undelegateEvents();
              delete self;
          } else {
              self.$(".signup-form").hide().removeClass('.focus');
              self.$(".login-form").show().addClass('.focus');
              self.$(".login-form .error").html("메시지를 보냈습니다. 이메일을 확인해주세요!").show();
              self.$(".signup-form button").removeAttr("disabled");
          }
        },

        error: function(user, error) {
          self.$(".signup-form .error").html("정보를 정확하게 입력해주세요!").show();
          self.$(".signup-form button").removeAttr("disabled");
        }
      });

      this.$(".signup-form button").attr("disabled", "disabled");

      return false;
    },
    render: function() {
      this.$el.html(_.template($("#login-template").html()));
      this.delegateEvents();
    }
  });

    
  // The main view for the app
  var AppView = Parse.View.extend({
    // Instead of generating a new element, bind to the existing skeleton of
    // the App already present in the HTML.
    el: $("#lounge"),

    initialize: function() {
      this.render();
    },

    render: function() {
      if (Parse.User.current()) {
        new ManageTodosView();
      } else {
        new LogInView();
      }
    }
  });

  var AppRouter = Parse.Router.extend({
    routes: {
      "all": "all",
      "active": "active",
      "completed": "completed"
    },

    initialize: function(options) {
    },

    all: function() {
      state.set({ filter: "all" });
    },

    active: function() {
      state.set({ filter: "active" });
    },

    completed: function() {
      state.set({ filter: "completed" });
    }
  });

  
  var state = new AppState;

  new AppRouter;
  new AppView;
  Parse.history.start();
});

/* Spin.js jQuery plugin */
$.fn.spin = function(opts) {
  this.each(function() {
    var $this = $(this),
        data = $this.data();

    if (data.spinner) {
      data.spinner.stop();
      delete data.spinner;
    }
    if (opts !== false) {
      data.spinner = new Spinner($.extend({color: $this.css('color')}, opts)).spin(this);
    }
  });
  return this;
};
