-- SELECTのみ。削除は未実行。
select * from public.futsal_goods where video_id in (
  'team-room-test-20261011-sunfires-a:前半',
  'team-room-test-20261011-sunfires-a:後半',
  'team-room-test-20261011-8motion-a:前半',
  'team-room-test-20261011-8motion-a:後半',
  'team-room-test-20261011-shared:前半',
  'team-room-test-20261011-shared:後半',
  'team-room-test-20261011-sunfires-old:前半',
  'team-room-test-20261011-sunfires-old:後半',
  'team-room-test-20261011-8motion-old:前半',
  'team-room-test-20261011-8motion-old:後半',
  'team-room-test-20261011-unpublished:前半',
  'team-room-test-20261011-unpublished:後半',
  'team-room-test-20261011-unrecorded:前半',
  'team-room-test-20261011-unrecorded:後半'
);
