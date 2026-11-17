-- Dataset name: devsnapkit_events. Change the identifier if you choose another name.
-- blob1=server environment, blob2=event, blob3=utm_source, blob4=utm_medium,
-- blob5=utm_campaign, blob6=ref, blob7=sessionId, blob8=path; double1=1.
-- Sample-weighted event counts over 30 days. Preview requires an explicit filter change.
SELECT if(blob3 = '', 'direct', blob3) AS utm_source,
  SUM(IF(blob2 = 'visit', _sample_interval, 0)) AS visit,
  SUM(IF(blob2 = 'editor_open', _sample_interval, 0)) AS editor_open,
  SUM(IF(blob2 = 'export', _sample_interval, 0)) AS export,
  SUM(IF(blob2 = 'payment', _sample_interval, 0)) AS payment
FROM devsnapkit_events
WHERE blob1 = 'production' AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY utm_source ORDER BY visit DESC;
