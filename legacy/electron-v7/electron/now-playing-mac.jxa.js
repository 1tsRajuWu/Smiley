function run() {
  try {
    var MediaRemote = $.NSBundle.bundleWithPath('/System/Library/PrivateFrameworks/MediaRemote.framework/');
    MediaRemote.load;

    var MRNowPlayingRequest = $.NSClassFromString('MRNowPlayingRequest');
    var item = MRNowPlayingRequest.localNowPlayingItem;
    if (!item) return '';

    var infoDict = item.nowPlayingInfo;
    if (!infoDict) return '';

    var titleVal = infoDict.valueForKey('kMRMediaRemoteNowPlayingInfoTitle');
    if (!titleVal) return '';

    var albumVal = infoDict.valueForKey('kMRMediaRemoteNowPlayingInfoAlbum');
    var artistVal = infoDict.valueForKey('kMRMediaRemoteNowPlayingInfoArtist');
    var elapsedVal = infoDict.valueForKey('kMRMediaRemoteNowPlayingInfoElapsedTime');
    var durationVal = infoDict.valueForKey('kMRMediaRemoteNowPlayingInfoDuration');
    var timestampVal = infoDict.valueForKey('kMRMediaRemoteNowPlayingInfoTimestamp');
    var rateVal = infoDict.valueForKey('kMRMediaRemoteNowPlayingInfoPlaybackRate');
    var client = MRNowPlayingRequest.localNowPlayingPlayerPath.client;
    var appName = client && client.displayName ? client.displayName.js : '';
    var playing = MRNowPlayingRequest.localIsPlaying;

    var elapsed = elapsedVal ? Number(elapsedVal.js) : 0;
    var duration = durationVal ? Number(durationVal.js) : 0;
    var timestamp = timestampVal ? String(timestampVal.js) : '';
    var rate = rateVal ? Number(rateVal.js) : (playing ? 1 : 0);

    return JSON.stringify({
      title: titleVal.js,
      artist: artistVal ? artistVal.js : '',
      album: albumVal ? albumVal.js : '',
      device: appName,
      isPlaying: !!playing,
      elapsedSeconds: elapsed,
      durationSeconds: duration,
      timestamp: timestamp,
      playbackRate: rate,
    });
  } catch (e) {
    return '';
  }
}
