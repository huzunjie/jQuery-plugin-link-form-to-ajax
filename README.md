# jQuery-plugin-link-form-to-ajax
一个劫持链接&amp;表单为ajax请求的jQuery插件

多年前的一个jQuery插件，可以省掉表单提交中的JS逻辑，详细说明参见JS文件注释

=====================

普通A标签链接或form提交请求转Ajax：
```
使用方法1：<a href="/xxx?attr=val&a2=v2" class="_send_to_ajax">点击后发ajax post请求</a>
使用方法2：<b data-action="/xxx" data-ajax-data="attr=val&a2=v2" method="post" class="_send_to_ajax">点击后发ajax post请求</b>
使用方法3：<form action="/xxx" method="post" class="_send_to_ajax">submit时截获并改为ajax请求</form>
使用方法4：<form action="/xxx" method="post" class="_send_to_ajax" data-reload-delay="1000">submit时截获并改为ajax请求，并且如果提交成功则在1000毫秒后重新加载当前页</form>
自定义事件：
     提交前   submit_before  (return false 将阻止本次请求)
     提交后   submit_after
     提交完毕 submit_complete
     提交成功 submit_success (这里的success 标识error_code == 0，非0会触发submit_error)
     提交失败 submit_error   (包含HTTP异常和error_code非0的情况)
```

另外，被劫持的表单子元素自动支持联动功能（实现表单值变化后UI跟着变），对于不劫持ajax请求的表单，可以`$('form').linkageForm()`启用联动逻辑：
 当带有data-is-linkage的元素发生value变化的时候，按当前元素name查找关联元素进行显示隐藏，并对关联元素内的表单进行disabled处理
 关联示例：
```
  <select name="type" data-is-linkage>
      <option value="">不选</option>
      <option value="1">类型1</option>
      <option value="2">类型2</option>
  </select>
  当前类型为：<i data-bind="type" />
  <span data-if-type="1">
      请填写类型1详情：<input name='type1_desc'>
  </span>
  <span data-if-type="2">
      请填写类型2详情：<input name='type1_desc'>
  </span>
  <span data-if-type-empty>
      请填写不选类型的原因：<input name='type_blll'>
  </span>
  <span data-if-type-noempty>
      请填写选类型的原因：<input name='type_blll'>
  </span>
```

再另外，如果表单项要启用命名空间（比如服务端期望接受到 `json:'{ "input_name":val1 }'` 这种数据）
   可以这么写： `<input data-namespace="json" name='input_name'>` 理论上支持多维嵌套
再另外，可以使用 `$('form').backfillForm(data)` 进行表单回填（这时候可以在DOM元素上使用data-tmpl属性设置关联JS模板，走JS模板渲染）、使用 `$form.resetForm()` 进行重置。
