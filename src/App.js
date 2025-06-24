from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from flask import Flask, request
from flask_cors import CORS
import sqlite3
import json

app = Flask(__name__)
CORS(app)

@app.route('/location')
def fetch_conn():
    locId = request.args['id']
    conn = sqlite3.connect("cache.db")
    cur = conn.cursor()
    j = cur.execute("SELECT conn FROM rtuGatewayConn WHERE locationId = (?)", (locId,)).fetchone()
    if j is None:
        return [], 404
    else:
        return json.loads(j[0])

@app.route('/location/refresh')
def refresh_conn():
    locId = request.args['id']
    conn = sqlite3.connect("cache.db")
    cur = conn.cursor()
    name = cur.execute("SELECT name FROM locations WHERE id = (?)", (locId,)).fetchone()
    if name == []:
        return [], 404
    else:
        client = firestore.Client()
        locRef = client.document(locId)

        rtuInfo = {}
        gateways = {}
        rtuGwConn = {}

        for i in locRef.collection('assets').where(filter=FieldFilter('assetConfig.nodeConfig.nodeType', '==', 'RTU_LORA')).stream():
            doc = i.to_dict()
            if not doc['deleted']:
                tUuid = doc['assetConfig']['nodeConfig']['thingUUID']
                loc = doc['thingId'][:doc['thingId'].index('/assets/')]
                lat = doc['assetConfig']['coordinates']['latitude']
                long = doc['assetConfig']['coordinates']['longitude']
                name = doc['name']
                rtuInfo[tUuid] = {'loc':loc, 'lat':lat, 'long':long, 'assetName':name}

                thingObj = client.collection('things').where(filter=FieldFilter('thingUUID', "==", tUuid)).get()[0].to_dict()
                rtuInfo[tUuid]['thingId'] = thingObj['thingId']

                rtuGwConn[tUuid] = []
                try:
                    for j in thingObj['gateways']:
                        gateways[j['fromNodeUUID']] = j['fromNodeId']
                        rtuGwConn[tUuid].append([j['fromNodeUUID'], j['direct'], j['lastUploadAt']])
                except KeyError:
                    return [{}]

        gwInfo = {}

        for i in gateways.keys():
            try:
                gwObj = client.collection_group('assets').where(filter=FieldFilter('assetConfig.thingUUIDs', 'array_contains', i)).get()[0].to_dict()
                loc = gwObj['thingId'][:gwObj['thingId'].index('/assets/')]
                lat = gwObj['assetConfig']['coordinates']['latitude']
                long = gwObj['assetConfig']['coordinates']['longitude']
                name = gwObj['name']
                gwInfo[i] = {'loc': loc, 'lat': lat, 'long': long, 'thingId':gateways[i], 'assetName':name}
            except:
                pass

        nodes = []

        for i in rtuGwConn:
            for j in rtuGwConn[i]:
                try:
                    nodes.append({'source':rtuInfo[i]['thingId'], 'target':gwInfo[j[0]]['thingId'], 'direct':j[1], 'lastUpload':j[2]})
                except:
                    pass

        levels = []

        for i in rtuInfo:
            obj = rtuInfo[i]
            dict = {'id':obj['thingId'], 'type':'rtu', 'location':obj['loc'], 'latitude':obj['lat'], 'longitude':obj['long'], 'assetName':obj['assetName']}
            levels.append(dict)

        for i in gwInfo:
            obj = gwInfo[i]
            dict = {'id': obj['thingId'], 'type': 'gateway', 'location': obj['loc'], 'latitude': obj['lat'], 'longitude': obj['long'], 'assetName':obj['assetName']}
            levels.append(dict)

        cur.execute("CREATE TABLE IF NOT EXISTS rtuGatewayConn(locationId TEXT, conn JSON)")
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS locId ON rtuGatewayConn(locationId)")

        cur.execute("INSERT OR REPLACE INTO rtuGatewayConn(conn, locationId) VALUES(?, ?)", (json.dumps([levels, nodes]), locId))
        conn.commit()
        cur.close()
        conn.close()
        return []

@app.route('/site_list/refresh')
def refresh_locations():
    conn = sqlite3.connect("cache.db")
    cur = conn.cursor()

    cur.execute("DROP TABLE IF EXISTS locations")
    cur.execute('CREATE TABLE IF NOT EXISTS locations(id TEXT, name TEXT)')

    client = firestore.Client()
    for i in client.collection_group("locations").stream():
        doc = i.to_dict()
        try:
            if doc['deleted']:
                continue
            cur.execute('INSERT INTO locations(id, name) VALUES(?, ?)', (doc['thingId'], doc['name']))
        except:
            pass
    conn.commit()
    cur.close()
    conn.close()
    return []

@app.route('/site_list')
def fetch_locations():
    conn = sqlite3.connect("cache.db")
    cur = conn.cursor()
    names = []

    for i in cur.execute('SELECT name, id FROM locations').fetchall():
        names.append({'name':i[0], 'url':i[1]})

    return names

app.run(host='0.0.0.0', port=5000)
