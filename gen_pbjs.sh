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

# if inside container `/apollo` is the apollo worksapce
APOLLO_ROOT=${APOLLO_ROOT:=/apollo}
if [[ ! -d ${APOLLO_ROOT} ]]; then
    # if repo located in data/frontend, `../../` is the workspace
    APOLLO="../../"
fi
if [[ ! -d ${APOLLO_ROOT} ]]; then
    echo "APOLLO_ROOT detect failed, you should specific via environ APOLLO_ROOT" 1>&2
fi
# proto dependencies
DREAMVIEW_PROTOS="${APOLLO_ROOT}/modules/dreamview/proto/*.proto"
COMMON_MSGS_PROTOS="${APOLLO_ROOT}/modules/common_msgs/*/*.proto"

DV_POINT_CLOUD_PROTOS="${APOLLO_ROOT}/modules/dreamview/proto/point_cloud.proto"

echo "generating proto bundle with proto files in ${APOLLO_ROOT}"

echo "generating sim_world_proto_bundle"
node_modules/protobufjs/bin/pbjs \
    -t json \
    $DREAMVIEW_PROTOS \
    $COMMON_MSGS_PROTOS \
    -o proto_bundle/sim_world_proto_bundle.json
echo "generating sim_world_proto_bundle done"

echo "generating point_cloud_proto_bundle"
node_modules/protobufjs/bin/pbjs \
    -t json \
    $DV_POINT_CLOUD_PROTOS \
    -o proto_bundle/point_cloud_proto_bundle.json
echo "generating point_cloud_proto_bundle done"
