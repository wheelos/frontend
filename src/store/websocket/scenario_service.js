import WS from 'store/websocket';

export default class ScenarioService {
  /**
   * 告知后端切换当前场景
   * 后端应该在这个 ACTION 里处理：寻找 scenario_id.json，触发地图切换
   * @param {string} id - 场景 ID
   */
  static changeScenario(id) {
    WS.changeScenario(id);
  }

  /**
   * 通知后端开始运行障碍物的生命周期
   * 在后端触发 SimControl 侧的场景事件循环，开始根据 time / ego_distance 发布感知消息
   */
  static startSimulation() {
    // 根据 HMI Action 发送 PLAY_SCENARIO 指令
    WS.websocket.send(JSON.stringify({
      type: 'HMIAction',
      action: 'PLAY_SCENARIO',
    }));
  }

  /**
   * 通知后端重置当前场景
   * 在后端清空在跑的动态障碍物，或者让主车回到规划起点
   */
  static resetSimulation() {
    WS.websocket.send(JSON.stringify({
      type: 'HMIAction',
      action: 'RESET_SCENARIO',
    }));
  }

  /**
   * 通知后端列出本地目录中的所有可用场景
   * 这应当通过 HMIAction 触发后端重新扫描 config/scenarios (或其他)
   */
  static fetchLocalScenarios() {
    WS.loadLoocalScenarioSets();
  }
}
