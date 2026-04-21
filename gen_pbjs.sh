#!/usr/bin/env bash

###############################################################################
# Copyright 2017 The Apollo Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
###############################################################################

mkdir -p proto_bundle

# proto dependencies
DREAMVIEW_PROTO='../../modules/dreamview/proto/*.proto'
COMMON_MSGS_PROTOS='../../modules/common_msgs/*/*.proto'

DV_POINT_CLOUD_PROTOS='../../modules/dreamview/proto/point_cloud.proto'

echo "generating sim_world_proto_bundle"
node_modules/protobufjs/bin/pbjs \
    -t json \
    $DREAMVIEW_PROTO \
    $COMMON_MSGS_PROTOS \
    -o proto_bundle/sim_world_proto_bundle.json
echo "generating sim_world_proto_bundle done"

echo "generating point_cloud_proto_bundle"
node_modules/protobufjs/bin/pbjs \
    -t json \
    $DV_POINT_CLOUD_PROTOS \
    -o proto_bundle/point_cloud_proto_bundle.json
echo "generating point_cloud_proto_bundle done"
