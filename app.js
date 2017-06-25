(function(exports) {

	var pl_tracks = [];
	var track_urls = [];

	var client_id = '4d78f4f5135944c9b2f05bcabff6b557';
	var redirect_uri = null
	if (window.location.hostname == 'localhost') {
		redirect_uri = 'http://localhost/callback.html';
	} else {
		redirect_uri = 'https://atran39.github.io/callback.html'
	}

	var getAccessToken = function() {
		return location.hash.match(/^\#access_token=(.+)&token_type=(.+)&expires_in=(\d+)$/)[1];
	}

	var splitText = function(inputtext) {
		var words = inputtext
		.split(/[\n\r]/)
		// .map(function(w) { return w.replace(/^\d+ /,'').replace(/[\d,]+$/,'')}) // rm rank, count
		.map(function(w) { return w.trim().replace(/^[.,-]+/,'').replace(/[.,-]+$/g,''); })
		.filter(function(w) { return (w.length > 0); });
		return words;
	}

	var addToQueue = function() {
		var new_urls = [];

		pl_name = $('#plName').val().trim();
		if (pl_name.trim() == "") {
			pl_name = new Date($.now())
		}

		var words = splitText($('#alltext').val()); // words is song, artist combination

		words.forEach(function(curr) {
			var url = '';

			if (curr.match(/\t/)) {
				curr = curr.split(/[\t]/);
			} else {
				curr = curr.split(/,/);
			}
			// console.log(curr);
			if (curr.length == 3) {
				// 538 playlist
				// console.log("error on", curr);
				if (curr[0].match(/^\d$/)) {
					// Wedding playlist
					url = 'https://api.spotify.com/v1/search?q='
					+ encodeURIComponent(curr[1]) + '&type=track&limit=1';
				} else {
					// Workout playlist
					url = 'https://api.spotify.com/v1/search?q='
					+ encodeURIComponent(curr[0] + ' ' + curr[1]) + '&type=track&limit=1';
				}
			} else {
				// CSV
				url = 'https://api.spotify.com/v1/search?q='
				+ encodeURIComponent(curr[0] + ' ' + curr[1]) + '&type=track&limit=1';
			}

			new_urls.push(url);
		});

		return track_urls = new_urls;
	}

	var createPl = function (access_token,track_html) {
		if (track_urls.length > 0) {
			url = track_urls[0];

			$.ajax({
				url: url,
				dataType: 'json',
				headers: {
					'Authorization': 'Bearer ' + access_token
				},
				success: function(r) {
					// console.log('got track', r);
					// track_uris.shift();
					if (jQuery.isEmptyObject(r.tracks.items)) {
						console.log('fail to get track info', r)
						// not found on spotify
						name = url.replace(/^https:\/\/api\.spotify\.com\/v1\/search\?q=/, '').replace(/&type=track&limit=1$/,'');
						track_html += '<div class="media bg-danger">No match found for "' + decodeURIComponent(name)+ '"</div>\n';
						track_urls.shift();
					} else {
						// console.log('found track', r);
						// console.log(r.tracks.items[0].uri);
						track_html += '<div class="media">' +
						'<a class="pull-left" href="#"><img class="media-object" src="' + r.tracks.items[0].album.images[r.tracks.items[0].album.images.length - 1].url + '" /></a>' +
						'<div class="media-body">' +
						'<h4 class="media-heading"><a href="' + r.tracks.items[0].uri + '">' + r.tracks.items[0].name + '</a></h4>' +
						'Album: <a href="' + r.tracks.items[0].album_uri + '">' + r.tracks.items[0].album.name +
						'</a><br/>Artist: <a href="' + r.tracks.items[0].artists[0].uri + '">' + r.tracks.items[0].artists[0].name+'</a>' +
						'</div>' +
						'</div>\n';
						pl_tracks.push(r.tracks.items[0].uri);
						track_urls.shift();
					}
					$('#tracks').html(track_html);
					createPl(access_token,track_html);
				},
				error: function(jqXHR,textStatus,errorThrown) {
					// timeout
					console.log('errorThrown:',errorThrown);
					if (errorThrown == 'Unauthorized') {
						window.location.replace(redirect_uri);
					} else if (errorThrown == 'Too Many Requests') {
						// time delay
						console.log('too');
					}
				}
			});
		} else {
			// reenable button
			$('#create').prop('disabled',false);
			//console.log('able');
			console.log('Creation finished');
		}
	}

	var uploadPlaylist = function(access_token,pl_name) {
		var username = null;
		var pl_id = null;

		console.log('get username');
		$.ajax({
			url: 'https://api.spotify.com/v1/me',
			dataType: 'json',
			headers: {
				'Authorization': 'Bearer ' + access_token
			},
			success: function(r) {
				username = r.id;
				console.log('create playlist');
				var url = 'https://api.spotify.com/v1/users/' + encodeURIComponent(username) + '/playlists';
				console.log(url);
				$.ajax(url, {
					method: 'POST',
					data: JSON.stringify({
						'name': pl_name,
						'public': false
					}),
					dataType: 'json',
					headers: {
						'Authorization': 'Bearer ' + access_token,
						'Content-Type': 'application/json'
					},
					success: function(r) {
						console.log('create playlist response', r);
						pl_id = r.id;
						addTrack(username,pl_id,access_token);
					},
					error: function(r) {
						console.log(r);
						window.location.replace(redirect_uri);
					}
				});
			},
			error: function(r) {
				// timeout
				console.log(r);
				window.location.replace(redirect_uri);
			}
		});
		console.log('username: ',username);
	}

	var addTrack = function(user_id,playlist_id,access_token) {
		var curr_index = 0;
		var url = 'https://api.spotify.com/v1/users/' + user_id +
		'/playlists/' + playlist_id +
		'/tracks'
		do {
			var data = '"uris": ' + 'position' + curr_index
			$.ajax({
				url: url,
				method: 'POST',
				data: JSON.stringify({
					'uris': pl_tracks.slice(curr_index,curr_index+100),
					'position': curr_index
				}), //JSON.stringify(tracks),
				dataType: 'text',
				headers: {
					'Authorization': 'Bearer ' + access_token,
					'Content-Type': 'application/json'
				},
				success: function(r) {
					console.log('added tracks response', r);
				},
				error: function(r) {
					console.log(r);
					window.location.replace(redirect_uri);
				}
			});
			curr_index += 100;
		} while ((pl_tracks.length - curr_index) > 0);
		console.log('done adding tracks');
	}

	exports.startApp = function() {
		console.log('start app.');
		var access_token = getAccessToken();

		$('#create').click(function() {
			console.log('disable');
			$('#create').prop('disabled',true);
			var track_html = '';
			addToQueue();
			createPl(access_token,track_html);
		});
		$('#upload').click(function() {
			// doLogin();
			console.log('upload');
			var pl_name = $('#plName').val().trim();
			uploadPlaylist(access_token,pl_name);
		});

	}

})(window);
