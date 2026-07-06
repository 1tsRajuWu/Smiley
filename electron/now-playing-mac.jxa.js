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
    var client = MRNowPlayingRequest.localNowPlayingPlayerPath.client;
    var appName = client && client.displayName ? client.displayName.js : '';
    var playing = MRNowPlayingRequest.localIsPlaying;

    return JSON.stringify({
      title: titleVal.js,
      artist: artistVal ? artistVal.js : '',
      album: albumVal ? albumVal.js : '',
      device: appName,
      isPlaying: !!playing,
    });
  } catch (e) {
    return '';
  }
}
