# AI 助手语音输入

用户确认轻量听写设计后实施。输入框麦克风打开紧凑浮层：首次开始前说明音频可能由浏览器在线服务处理，选择识别语言并开始；再次点击麦克风停止。结果写入可编辑草稿，不自动发送或执行文档修改。

采用 SpeechRecognition / webkitSpeechRecognition 能力检测，提供中、英、日、韩、德、西、葡语言标签；默认跟随界面语言。浏览器对语言和离线识别的支持不同，不承诺自动混合语言识别或完全本地处理。

录音期间禁止发送，停止等待最终结果。取消恢复原草稿；手动编辑立即终止识别并保留可见文字和光标。切换会话、界面语言、视图、关闭面板及 pagehide 清理识别，过期回调不可写入新草稿。单次识别 60 秒后清理，避免服务未回调时持续等待。状态、权限失败和不支持提示均本地化；按钮支持键盘和 Escape，状态通过 role=status 播报。

使用现有 ranui 语言选择器和公开 chat-ui actionsEl / setInput 契约，不新增录音上传接口、音频存储、语音播放或推理依赖。权限只在用户点击开始时由浏览器请求。

验证：回归测试覆盖语言映射、临时与最终结果、取消、停止、权限错误、会话结束的迟到回调及手动编辑保护。浏览器验证入口、语言选择、说明、取消与窄侧栏；未启动真实麦克风，识别准确率和浏览器服务可用性未实测。

参考：

- https://help.openai.com/en/articles/12168547-voice-dictation-faq
- https://support.google.com/gemini/answer/14554984
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
