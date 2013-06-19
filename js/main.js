// Global arrays
var markersArray = [];
var friendLists = [];

// Runs as soon as SDK has finished loading
window.fbAsyncInit = function() {
  FB.init({
    appId      : '383099538461243', // App ID
    channelUrl : '//loganjoecks.com/friends-map/channel.html', // Channel File
    status     : true, // check login status
    cookie     : true, // enable cookies to allow the server to access the session
    xfbml      : true  // parse XFBML
  });

  // Initialize blank map
  var mapOptions = {
    center: new google.maps.LatLng(0, 0),
    zoom: 3,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  var map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
  $("#map-canvas").height($(window).height() - $("#banner").height() - 20);


  // Event Listeners
  $("#currently").click(function(e) {
    initialize(map, "location", $.trim($(".dropdown-toggle").text()))
  });

  $("#hometown").click(function(e) {
    initialize(map, "hometown", $.trim($(".dropdown-toggle").text()))
  });

  $(".dropdown-menu").on('click', 'li a', function(){
    $(".dropdown-toggle").html($(this).text() + ' <span class="caret"></span>');
    var place = $("#currently").hasClass('active') ? "location" : "hometown";
    
    initialize(map,place,$(this).text())
  });

  // Here we subscribe to the auth.authResponseChange JavaScript event. This event is fired
  // for any authentication related change, such as login, logout or session refresh. This means that
  // whenever someone who was previously logged out tries to log in again, the correct case below 
  // will be handled. 
  FB.Event.subscribe('auth.authResponseChange', function(response) {
    // Here we specify what we do with the response anytime this event occurs. 
    if (response.status === 'connected') {
      // The response object is returned with a status field that lets the app know the current
      // login status of the person. In this case, we're handling the situation where they 
      // have logged in to the app.
      $('.after').show();
      getFriendLists();
      var place = $("#currently").hasClass('active') ? "location" : "hometown";
      var friendList = $.trim($(".dropdown-toggle").text());
      initialize(map, place,friendList);
    } else if (response.status === 'not_authorized') {
      console.log('not auth')
      // In this case, the person is logged into Facebook, but not into the app, so we call
      // FB.login() to prompt them to do so. 
      // In real-life usage, you wouldn't want to immediately prompt someone to login 
      // like this, for two reasons:
      // (1) JavaScript created popup windows are blocked by most browsers unless they 
      // result from direct interaction from people using the app (such as a mouse click)
      // (2) it is a bad experience to be continually prompted to login upon page load.
      FB.login();
    } else {
      console.log('not logged')
      // In this case, the person is not logged into Facebook, so we call the login() 
      // function to prompt them to do so. Note that at this stage there is no indication
      // of whether they are logged into the app. If they aren't then they'll see the Login
      // dialog right after they log in to Facebook. 
      // The same caveats as above apply to the FB.login() call here.
      FB.login();
    }
  });
};

// Load the SDK asynchronously
(function(d){
 var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
 if (d.getElementById(id)) {return;}
 js = d.createElement('script'); js.id = id; js.async = true;
 js.src = "//connect.facebook.net/en_US/all.js";
 ref.parentNode.insertBefore(js, ref);
}(document));

//Initializes a Friendlists array with a user's lists and their members.
function getFriendLists() {
  friendLists = [];

  $('.dropdown-menu').empty();
  $(".dropdown-menu").append('<li><a href="#">All</a></li>');

  FB.api('/me/?fields=friendlists.fields(members,name)', function(response) {
    for (var i=0; i < response.friendlists.data.length; i++) {
      var list = response.friendlists.data[i];

      if(list.members != undefined) {
        friendLists[list.name] = []

        for(var j=0; j < list.members.data.length; j++) {
          friendLists[list.name].push(list.members.data[j].id)
        }

        $(".dropdown-menu").append('<li><a href="#">' + list.name + '</a></li>');
      }
    }
  });
}

//Adds Markers and Infowindows to map from facebook friends using criteria from controls above.
function initialize(map, place, friendList) {

  clearOverlays();
  
  var markerBounds = new google.maps.LatLngBounds();
  var infowindow = new google.maps.InfoWindow();

  var locations = [];
  
  //Get all friends with fields name, picture, link and either location or homtown 
  FB.api('/me/friends?fields=name,picture,link,' + place, function(response) {

    var url = '?ids=';

    // Setup location array where locations[placeID] = list of friends and their data in that city
    for (var i=0; i < response.data.length; i++) {
      var friend = response.data[i];
      if(friend[place] != undefined && (friendList === 'All' ||($.inArray(friend.id, friendLists[friendList]) >= 0))) {
        if(locations[friend[place].id] == undefined) {
          locations[friend[place].id] = [];
          url += friend[place].id + ',';
        }
        locations[friend[place].id].push(friend);
      }
    }

    //Remove trailing comma
    url = url.substring(0, url.length-1);

    // For each city in the locations array, add a marker and info window
    // Markers may be a group marker (friendlist > 1) or individual.
    // Infowindows can list friends in that city or display a single friend.
    FB.api(url, function(res) {
      jQuery.each(res, function(id, city) {
        var cityFriends = locations[id];
        var myLatlng = new google.maps.LatLng(city.location.latitude, city.location.longitude);
        var icon, title, contentString;
        
        if (cityFriends.length == 1) {
          icon = cityFriends[0].picture.data.url;
          title = cityFriends[0].name + " (" + cityFriends[0][place].name + ")";
          contentString = '<center><strong><a href="' + cityFriends[0].link + '">' + cityFriends[0].name + "</a></strong>" + '<br> (<a href="'+ city.link + '">' + cityFriends[0][place].name + "</a>)</center>";
        }
        else {
          icon = "https://fbcdn-profile-a.akamaihd.net/static-ak/rsrc.php/v2/yo/r/UlIqmHJn-SK.gif";
          
          title = cityFriends.length; 
          title += (place === 'location') ? ' in ' : ' from ';
          title += cityFriends[0][place].name;
          
          contentString = '<center><h4>' + cityFriends[0][place].name + '</h4></center><table>';
          for(i=0; i < cityFriends.length; i++) {
            contentString += '<tr>'+
              '<td>'+
              '<img src="' + cityFriends[i].picture.data.url + '">'+
              '</td>'+
              '<td>'+
              '<a href="' + cityFriends[i].link + '">'+ 
              cityFriends[i].name
              '</a></td>'+
              '</tr>';
          }
          contentString += '</table>';
        }

        var marker = new google.maps.Marker({
          map: map,
          position: myLatlng,
          icon: icon,
          title: title,
          animation: google.maps.Animation.DROP
        });

        markersArray.push(marker);

        google.maps.event.addListener(marker, 'click', function() {
          infowindow.setContent(contentString)
          infowindow.open(map,marker);
        });
        markerBounds.extend(myLatlng);
        map.fitBounds(markerBounds);
      });
    });
  });
}

// Clears all markers from map
function clearOverlays() {
  for (var i = 0; i < markersArray.length; i++ ) {
    markersArray[i].setMap(null);
  }
  markersArray = [];
}
