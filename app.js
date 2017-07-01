(function(exports) {

	var pl_tracks = [];
	var track_urls = [];
	var pl_length = -1;

	var client_id = '4d78f4f5135944c9b2f05bcabff6b557'; // pls dont steal
	var redirect_uri = null
	if (window.location.hostname == 'localhost') {
		redirect_uri = 'http://localhost/index.html';
	} else {
		redirect_uri = 'https://atran39.github.io/index.html'
	}

	var getAccessToken = function() {
		return location.hash.match(/^\#access_token=(.+)&token_type=(.+)&expires_in=(\d+)$/)[1];
	}


	var addToQueue = function() {
		// process textarea, create relevant search urls
		var new_urls = [];

		pl_name = $('#plName').val().trim();
		if (pl_name.trim() == "") {
			pl_name = new Date($.now())
		}

		var words = $('#alltext').val().split(/[\n\r]/).filter(function(w) {return (w.length > 0);});

		words.forEach(function(curr) {
			var url = '';

			if (curr.match(/\t/)) {
				curr = curr.split(/[\t]/);

				if (curr.length >= 3) {
					// 538 playlist
					if (curr[2].match(/^\d\d?$/)) {
						// Wedding playlist
						url = 'https://api.spotify.com/v1/search?q='
						+ encodeURIComponent(curr[1]) + '&type=track&limit=1';
					} else {
						// Workout playlist
						url = 'https://api.spotify.com/v1/search?q='
						+ encodeURIComponent(curr[0] + ' ' + curr[1]) + '&type=track&limit=1';
					}
				}
			} else {
				// regular formatting
				url = 'https://api.spotify.com/v1/search?q='
				+ encodeURIComponent(curr) + '&type=track&limit=1';
			}

			new_urls.push(url);
		});

		// store uls array in track_urls
		pl_length = new_urls.length;
		return track_urls = new_urls;
	}

	var createPl = function (access_token,track_html) {
		// recursively perform http requests to obtain track uris
		if (track_urls.length > 0) {
			url = track_urls[0];

			// progress bar
			var valuenow = (pl_length - track_urls.length)/pl_length*100;
			$('#progress').html(
				'<div class="progress progress-striped active">' +
				'<div class="progress-bar" role="progressbar" aria-valuenow=\"' + valuenow + '\" aria-valuemin="0" aria-valuemax="100" style="width:' + valuenow + '%">' +
			 	'</div>' +
				'</div>'
			);

			$.ajax({
				url: url,
				dataType: 'json',
				headers: {
					'Authorization': 'Bearer ' + access_token
				},
				success: function(r) {
					if (jQuery.isEmptyObject(r.tracks.items)) {
						// not found on spotify
						console.log('fail to get track info', r)
						name = url.replace(/^https:\/\/api\.spotify\.com\/v1\/search\?q=/, '').replace(/&type=track&limit=1$/,'');
						track_html += '<div class="media bg-danger">No match found for "' + decodeURIComponent(name)+ '"</div>\n';
						track_urls.shift();
					} else {
						// track_html is a media object that visually displays obtained tracks
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
					// timeout, requires new login session
					console.log('errorThrown:',errorThrown);
					window.location.replace(redirect_uri);
				}
			});
		} else {
			// when finished, clean up button behavior
			$('#progress').html('');
			$('#upload').prop('disabled',false);
			$('#create').prop('disabled',false);

			document.getElementById('upload').textContent = ('Upload to Spotify');
			$('#upload').off('click');
			$('#upload').click(uploadClick);

			console.log('Creation finished');
		}
	}

	var uploadPlaylist = function(access_token,pl_name) {
		var username = null;
		var pl_id = null;

		$('#upload').prop('disabled',true);

		$.ajax({
			url: 'https://api.spotify.com/v1/me',
			dataType: 'json',
			headers: {
				'Authorization': 'Bearer ' + access_token
			},
			success: function(r) {
				username = r.id;
				var url = 'https://api.spotify.com/v1/users/' + encodeURIComponent(username) + '/playlists';
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
						pl_url = r.external_urls.spotify;
						console.log(pl_url);
						addTrack(username,pl_id,access_token,pl_url);
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
	}

	var addTrack = function(user_id,playlist_id,access_token,playlist_url) {
		var curr_index = 0;
		var url = 'https://api.spotify.com/v1/users/' + user_id +
		'/playlists/' + playlist_id +
		'/tracks'
		do {
			// only a max of 100 tracks can be added for any one http addtrack requests
			var data = '"uris": ' + 'position' + curr_index
			$.ajax({
				url: url,
				method: 'POST',
				data: JSON.stringify({
					'uris': pl_tracks.slice(curr_index,curr_index+100),
					'position': curr_index
				}),
				dataType: 'text',
				headers: {
					'Authorization': 'Bearer ' + access_token,
					'Content-Type': 'application/json'
				},
				success: function(r) {
				 	document.getElementById('upload').textContent = ('Done! View on Spotify');
					$('#upload').off('click');
					$('#upload').click(function () {window.open(playlist_url)});
					$('#upload').prop('disabled',false);
				},
				error: function(r) {
					console.log(r);
					alert('Error! Please create a playlist before uploading')
				}
			});
			curr_index += 100;
		} while ((pl_tracks.length - curr_index) > 0);
		console.log('done adding tracks');
	}

	var createClick = function() {
		var access_token = getAccessToken();
		pl_tracks = [];

		$('#progress').html(
			'<div class="progress progress-striped active">' +
			'<div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 100%">' +
			'</div>' +
			'</div>'
		);
		$('#create').prop('disabled',true);
		addToQueue();
		console.log(track_urls);
		createPl(access_token,'');
	}

	var uploadClick = function() {
		console.log('upload');
		var pl_name = $('#plName').val().trim();
		var access_token = getAccessToken();
		uploadPlaylist(access_token,pl_name);
	}

	exports.startApp = function() {
		console.log('starting playmaker');

		$('#upload').prop('disabled',true);

		$('#create').click(createClick);
		$('#upload').click(uploadClick);
	}
})(window);
