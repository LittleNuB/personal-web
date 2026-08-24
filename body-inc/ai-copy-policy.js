const FORBIDDEN_MEDICAL =
  /医学建议|医疗建议|诊断|就医|医生|伤病|受伤|伤痛|疼痛|痛感|损伤|治疗|康复训练|康复|后遗症|膝盖.{0,8}(疼|痛|伤|损)|腰.{0,8}(疼|痛|伤|损)|关节.{0,8}(疼|痛|伤|损)/i;
const FORBIDDEN_TRAINING =
  /真实训练|训练描述|训练建议|训练计划|训练周期|训练效率|训练效果|生物力学|运动链|力线|发力模式|发力|静态拉伸|拉伸流程|动作指导|动作姿势|坐姿|调整姿势|停止训练|继续训练|营养摄入|体脂率|HIIT|乳酸|蛋白质|热量|卡路里|增肌|减脂|建议.{0,12}(训练|锻炼|深蹲|卧推|硬拉|拉伸|热身)|应该.{0,12}(训练|锻炼|深蹲|卧推|硬拉|拉伸|热身)/i;
const FORBIDDEN_REAL_BODY =
  /真实身体|身体倾斜|失去支撑|支撑力|影响呼吸|呼吸困难|站立|行走|小腿.{0,8}(支撑|稳定)/i;
const NUMERICAL_TRAINING =
  /\d+(?:\.\d+)?\s*(?:kg|公斤|千克|斤|组|次|下)|(?:训练|锻炼|深蹲|卧推|硬拉|拉伸|热身).{0,12}\d+\s*(?:秒|分钟|小时)|\d+\s*(?:秒|分钟|小时).{0,12}(?:训练|锻炼|深蹲|卧推|硬拉|拉伸|热身)/i;

export function hasForbiddenAiCopy(value) {
  if (typeof value !== "string") return false;
  return (
    FORBIDDEN_MEDICAL.test(value) ||
    FORBIDDEN_TRAINING.test(value) ||
    FORBIDDEN_REAL_BODY.test(value) ||
    NUMERICAL_TRAINING.test(value)
  );
}
