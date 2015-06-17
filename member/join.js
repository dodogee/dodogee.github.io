var main = function() {
  $('.opButton').click(function() {
    var user = new Parse.User();
    user.set("email", $(.Email).show());
    user.set("password", $(.Password).show());
    user.set("name", $(.Name).show());
  });
}

$(document).ready(main);

user.signUp(null, {
  success: function(user) {
    // Hooray! Let them use the app now.
  },
  error: function(user, error) {
    // Show the error message somewhere and let the user try again.
    alert("Error: " + error.code + " " + error.message);
  }
});
